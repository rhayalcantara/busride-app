-- ============================================================
-- BusRide - Stored Procedures geoespaciales y de negocio
-- ============================================================

USE busride_db;
GO

-- ============================================================
-- SP: Buscar rutas con paradas cercanas al pasajero
-- Recibe lat/lng del pasajero y lat/lng del destino
-- Retorna rutas que pasan cerca de ambos puntos con asientos libres
-- ============================================================
CREATE OR ALTER PROCEDURE sp_buscar_rutas_disponibles
    @lat_origen     FLOAT,
    @lng_origen     FLOAT,
    @lat_destino    FLOAT,
    @lng_destino    FLOAT,
    @radio_metros   INT = 500
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @punto_origen   geography = geography::Point(@lat_origen, @lng_origen, 4326);
    DECLARE @punto_destino  geography = geography::Point(@lat_destino, @lng_destino, 4326);

    SELECT
        v.id                        AS viaje_id,
        r.id                        AS ruta_id,
        r.nombre                    AS ruta_nombre,
        r.codigo                    AS ruta_codigo,
        r.tarifa,
        v.asientos_disponibles,
        -- Parada de origen más cercana al pasajero
        p_origen.id                 AS parada_origen_id,
        p_origen.nombre             AS parada_origen_nombre,
        p_origen.referencia         AS parada_origen_referencia,
        ROUND(p_origen.ubicacion.STDistance(@punto_origen), 0)  AS distancia_origen_metros,
        -- Parada de destino más cercana al destino deseado
        p_destino.id                AS parada_destino_id,
        p_destino.nombre            AS parada_destino_nombre,
        p_destino.referencia        AS parada_destino_referencia,
        ROUND(p_destino.ubicacion.STDistance(@punto_destino), 0) AS distancia_destino_metros,
        -- ETA estimada (segundos desde ahora)
        u.nombre + ' ' + u.apellido AS conductor_nombre,
        b.placa                     AS bus_placa,
        b.modelo                    AS bus_modelo,
        -- Posición actual del bus
        v.posicion_actual.Lat       AS bus_lat,
        v.posicion_actual.Long      AS bus_lng,
        a.nombre                    AS asociacion_nombre
    FROM viajes v
    INNER JOIN rutas r              ON r.id = v.ruta_id
    INNER JOIN asociaciones a       ON a.id = r.asociacion_id
    INNER JOIN buses b              ON b.id = v.bus_id
    INNER JOIN conductores c        ON c.id = v.conductor_id
    INNER JOIN usuarios u           ON u.id = c.usuario_id
    -- Parada más cercana al origen del pasajero (dentro del radio)
    CROSS APPLY (
        SELECT TOP 1 p.id, p.nombre, p.referencia, p.ubicacion, p.orden
        FROM paradas p
        WHERE p.ruta_id = r.id
          AND p.ubicacion.STDistance(@punto_origen) <= @radio_metros
        ORDER BY p.ubicacion.STDistance(@punto_origen) ASC
    ) p_origen
    -- Parada más cercana al destino (posterior a la de origen en la ruta)
    CROSS APPLY (
        SELECT TOP 1 p.id, p.nombre, p.referencia, p.ubicacion, p.orden
        FROM paradas p
        WHERE p.ruta_id = r.id
          AND p.ubicacion.STDistance(@punto_destino) <= @radio_metros * 2
          AND p.orden > p_origen.orden
        ORDER BY p.ubicacion.STDistance(@punto_destino) ASC
    ) p_destino
    WHERE v.estado = 'EN_CURSO'
      AND v.asientos_disponibles > 0
    ORDER BY
        (p_origen.ubicacion.STDistance(@punto_origen) + p_destino.ubicacion.STDistance(@punto_destino)) ASC;
END;
GO

-- ============================================================
-- SP: Crear reserva provisional con TTL de 5 minutos
-- ============================================================
CREATE OR ALTER PROCEDURE sp_crear_reserva
    @pasajero_id        UNIQUEIDENTIFIER,
    @viaje_id           UNIQUEIDENTIFIER,
    @parada_origen_id   INT,
    @parada_destino_id  INT,
    @lat_pasajero       FLOAT,
    @lng_pasajero       FLOAT,
    @qr_token           NVARCHAR(500)
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRANSACTION;

    BEGIN TRY
        -- Verificar que hay asientos disponibles (bloqueo pesimista)
        DECLARE @asientos INT;
        SELECT @asientos = asientos_disponibles
        FROM viajes WITH (UPDLOCK, ROWLOCK)
        WHERE id = @viaje_id AND estado = 'EN_CURSO';

        IF @asientos IS NULL OR @asientos <= 0
        BEGIN
            ROLLBACK;
            SELECT 0 AS exito, 'Sin asientos disponibles' AS mensaje, NULL AS reserva_id;
            RETURN;
        END;

        DECLARE @reserva_id UNIQUEIDENTIFIER = NEWID();
        DECLARE @ubicacion geography = geography::Point(@lat_pasajero, @lng_pasajero, 4326);

        INSERT INTO reservas (id, pasajero_id, viaje_id, parada_origen_id, parada_destino_id,
                              qr_token, qr_expira_en, ubicacion_pasajero)
        VALUES (@reserva_id, @pasajero_id, @viaje_id, @parada_origen_id, @parada_destino_id,
                @qr_token, DATEADD(MINUTE, 5, GETDATE()), @ubicacion);

        COMMIT;
        SELECT 1 AS exito, 'Reserva creada' AS mensaje, @reserva_id AS reserva_id;
    END TRY
    BEGIN CATCH
        ROLLBACK;
        SELECT 0 AS exito, ERROR_MESSAGE() AS mensaje, NULL AS reserva_id;
    END CATCH;
END;
GO

-- ============================================================
-- SP: Confirmar abordaje al escanear QR
-- Descuenta saldo del pasajero, registra asiento, actualiza capacidad
-- ============================================================
CREATE OR ALTER PROCEDURE sp_confirmar_abordaje
    @qr_token       NVARCHAR(500),
    @conductor_id   UNIQUEIDENTIFIER,
    @numero_asiento INT
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRANSACTION;

    BEGIN TRY
        -- Validar QR y obtener datos de la reserva
        DECLARE @reserva_id     UNIQUEIDENTIFIER;
        DECLARE @pasajero_id    UNIQUEIDENTIFIER;
        DECLARE @viaje_id       UNIQUEIDENTIFIER;
        DECLARE @tarifa         DECIMAL(10,2);

        SELECT
            @reserva_id  = r.id,
            @pasajero_id = r.pasajero_id,
            @viaje_id    = r.viaje_id,
            @tarifa      = ru.tarifa
        FROM reservas r
        INNER JOIN viajes v ON v.id = r.viaje_id
        INNER JOIN rutas ru ON ru.id = v.ruta_id
        WHERE r.qr_token = @qr_token
          AND r.estado IN ('PROVISIONAL', 'CONFIRMADA')
          AND r.qr_expira_en > GETDATE();

        IF @reserva_id IS NULL
        BEGIN
            ROLLBACK;
            SELECT 0 AS exito, 'QR inválido o expirado' AS mensaje;
            RETURN;
        END;

        -- Verificar saldo del pasajero (con bloqueo)
        DECLARE @saldo_viajes INT;
        DECLARE @wallet_id    UNIQUEIDENTIFIER;

        SELECT @wallet_id = id, @saldo_viajes = saldo_viajes
        FROM wallet_pasajeros WITH (UPDLOCK, ROWLOCK)
        WHERE pasajero_id = @pasajero_id;

        IF @saldo_viajes < 1
        BEGIN
            ROLLBACK;
            SELECT 0 AS exito, 'Saldo de viajes insuficiente' AS mensaje;
            RETURN;
        END;

        -- Descontar saldo
        UPDATE wallet_pasajeros
        SET saldo_viajes = saldo_viajes - 1,
            fecha_actualizacion = GETDATE()
        WHERE id = @wallet_id;

        -- Registrar transacción
        INSERT INTO transacciones (pasajero_id, tipo, viajes_cantidad, estado, descripcion)
        VALUES (@pasajero_id, 'ABORDAJE', -1, 'COMPLETADA',
                'Abordaje viaje ' + CAST(@viaje_id AS NVARCHAR(50)));

        -- Generar ticket
        DECLARE @ticket_codigo NVARCHAR(50) = 'TK-' + REPLACE(CAST(NEWID() AS NVARCHAR(36)), '-', '');

        -- Registrar abordaje
        DECLARE @abordaje_id UNIQUEIDENTIFIER = NEWID();
        INSERT INTO abordajes (id, reserva_id, pasajero_id, viaje_id, conductor_id,
                               numero_asiento, monto_cobrado, tipo_pago, ticket_codigo)
        VALUES (@abordaje_id, @reserva_id, @pasajero_id, @viaje_id, @conductor_id,
                @numero_asiento, @tarifa, 'SALDO_VIAJES', @ticket_codigo);

        -- Actualizar estado de la reserva
        UPDATE reservas
        SET estado = 'ABORDADA', numero_asiento = @numero_asiento, fecha_abordaje = GETDATE()
        WHERE id = @reserva_id;

        -- Reducir asientos disponibles en el viaje
        UPDATE viajes
        SET asientos_disponibles = asientos_disponibles - 1
        WHERE id = @viaje_id;

        -- Actualizar ingreso total del viaje
        UPDATE viajes SET ingreso_total = ingreso_total + @tarifa WHERE id = @viaje_id;

        -- Incrementar contador de viajes del pasajero
        UPDATE pasajeros SET viajes_realizados = viajes_realizados + 1 WHERE id = @pasajero_id;

        COMMIT;

        -- Retornar datos del abordaje confirmado
        SELECT
            1 AS exito,
            'Abordaje confirmado' AS mensaje,
            @abordaje_id AS abordaje_id,
            @ticket_codigo AS ticket_codigo,
            @numero_asiento AS asiento,
            @tarifa AS monto,
            (SELECT asientos_disponibles FROM viajes WHERE id = @viaje_id) AS asientos_restantes;

    END TRY
    BEGIN CATCH
        ROLLBACK;
        SELECT 0 AS exito, ERROR_MESSAGE() AS mensaje;
    END CATCH;
END;
GO

-- ============================================================
-- SP: Liquidar viaje al finalizar ruta
-- ============================================================
CREATE OR ALTER PROCEDURE sp_liquidar_viaje
    @viaje_id       UNIQUEIDENTIFIER,
    @conductor_id   UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @ingreso_bruto      DECIMAL(10,2);
    DECLARE @total_abordajes    INT;
    DECLARE @pct_plataforma     DECIMAL(5,2);
    DECLARE @pct_asociacion     DECIMAL(5,2);
    DECLARE @comision_plat      DECIMAL(10,2);
    DECLARE @comision_asoc      DECIMAL(10,2);
    DECLARE @monto_neto         DECIMAL(10,2);

    -- Obtener ingresos del viaje
    SELECT @ingreso_bruto = ingreso_total FROM viajes WHERE id = @viaje_id;
    SELECT @total_abordajes = COUNT(*) FROM abordajes WHERE viaje_id = @viaje_id;

    -- Obtener comisiones vigentes
    SELECT TOP 1
        @pct_plataforma = pct_plataforma,
        @pct_asociacion = pct_asociacion
    FROM config_comisiones
    WHERE activo = 1 AND fecha_desde <= CAST(GETDATE() AS DATE)
      AND (fecha_hasta IS NULL OR fecha_hasta >= CAST(GETDATE() AS DATE))
    ORDER BY fecha_desde DESC;

    SET @comision_plat = @ingreso_bruto * (@pct_plataforma / 100);
    SET @comision_asoc = @ingreso_bruto * (@pct_asociacion / 100);
    SET @monto_neto    = @ingreso_bruto - @comision_plat - @comision_asoc;

    -- Registrar liquidación
    INSERT INTO liquidaciones
        (conductor_id, viaje_id, periodo_inicio, periodo_fin,
         total_abordajes, ingreso_bruto, comision_plataforma, comision_asociacion, monto_neto)
    VALUES
        (@conductor_id, @viaje_id, CAST(GETDATE() AS DATE), CAST(GETDATE() AS DATE),
         @total_abordajes, @ingreso_bruto, @comision_plat, @comision_asoc, @monto_neto);

    -- Marcar viaje como finalizado
    UPDATE viajes SET estado = 'FINALIZADO', fecha_fin = GETDATE() WHERE id = @viaje_id;

    -- Actualizar total de viajes del conductor
    UPDATE conductores SET total_viajes = total_viajes + 1 WHERE id = @conductor_id;

    SELECT
        @total_abordajes    AS total_pasajeros,
        @ingreso_bruto      AS ingreso_bruto,
        @comision_plat      AS comision_plataforma,
        @comision_asoc      AS comision_asociacion,
        @monto_neto         AS monto_neto_conductor;
END;
GO

-- ============================================================
-- SP: Expirar reservas provisionales vencidas (ejecutar cada minuto)
-- ============================================================
CREATE OR ALTER PROCEDURE sp_expirar_reservas
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE reservas
    SET estado = 'EXPIRADA'
    WHERE estado IN ('PROVISIONAL', 'CONFIRMADA')
      AND qr_expira_en < GETDATE();

    SELECT @@ROWCOUNT AS reservas_expiradas;
END;
GO

-- ============================================================
-- SP: Obtener pasajeros esperando en una parada (para el conductor)
-- ============================================================
CREATE OR ALTER PROCEDURE sp_pasajeros_en_parada
    @viaje_id       UNIQUEIDENTIFIER,
    @parada_id      INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        r.id            AS reserva_id,
        u.nombre + ' ' + u.apellido AS nombre_pasajero,
        u.telefono,
        p_foto.foto_url,
        r.fecha_creacion AS hora_reserva,
        par_dest.nombre  AS parada_destino
    FROM reservas r
    INNER JOIN pasajeros pas         ON pas.id = r.pasajero_id
    INNER JOIN usuarios u            ON u.id = pas.usuario_id
    LEFT  JOIN pasajeros p_foto      ON p_foto.id = pas.id
    INNER JOIN paradas par_dest      ON par_dest.id = r.parada_destino_id
    WHERE r.viaje_id = @viaje_id
      AND r.parada_origen_id = @parada_id
      AND r.estado IN ('PROVISIONAL', 'CONFIRMADA')
    ORDER BY r.fecha_creacion ASC;
END;
GO

-- ============================================================
-- SP: Actualizar calificación promedio del conductor
-- ============================================================
CREATE OR ALTER PROCEDURE sp_actualizar_calificacion_conductor
    @conductor_id   UNIQUEIDENTIFIER
AS
BEGIN
    UPDATE conductores
    SET calificacion_promedio = (
        SELECT AVG(CAST(estrellas AS DECIMAL(3,2)))
        FROM calificaciones
        WHERE conductor_id = @conductor_id
    )
    WHERE id = @conductor_id;
END;
GO
