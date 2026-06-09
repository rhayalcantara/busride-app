-- ============================================================
-- BusRide - Schema completo con tipos geoespaciales SQL Server
-- geography: coordenadas WGS84 (lat/lng reales)
-- STDistance: distancia en metros entre dos puntos
-- STBuffer: área circular alrededor de un punto
-- ============================================================

USE busride_db;
GO

-- ============================================================
-- MÓDULO 1: Usuarios y Autenticación
-- ============================================================

CREATE TABLE roles (
    id          INT IDENTITY(1,1) PRIMARY KEY,
    nombre      NVARCHAR(50) NOT NULL UNIQUE,  -- pasajero, conductor, asociacion, admin
    descripcion NVARCHAR(200)
);

CREATE TABLE usuarios (
    id              UNIQUEIDENTIFIER DEFAULT NEWID() PRIMARY KEY,
    email           NVARCHAR(255) NOT NULL UNIQUE,
    password_hash   NVARCHAR(255) NOT NULL,
    nombre          NVARCHAR(100) NOT NULL,
    apellido        NVARCHAR(100) NOT NULL,
    telefono        NVARCHAR(20),
    rol_id          INT NOT NULL REFERENCES roles(id),
    activo          BIT DEFAULT 1,
    verificado      BIT DEFAULT 0,
    token_verificacion NVARCHAR(100),
    fecha_creacion  DATETIME2 DEFAULT GETDATE(),
    fecha_actualizacion DATETIME2 DEFAULT GETDATE(),
    ultimo_login    DATETIME2
);
CREATE INDEX IX_usuarios_email ON usuarios(email);
CREATE INDEX IX_usuarios_rol ON usuarios(rol_id);

CREATE TABLE tokens_refresco (
    id          UNIQUEIDENTIFIER DEFAULT NEWID() PRIMARY KEY,
    usuario_id  UNIQUEIDENTIFIER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    token       NVARCHAR(500) NOT NULL UNIQUE,
    expira_en   DATETIME2 NOT NULL,
    revocado    BIT DEFAULT 0,
    fecha_creacion DATETIME2 DEFAULT GETDATE()
);

-- ============================================================
-- MÓDULO 2: Asociaciones y Conductores
-- ============================================================

CREATE TABLE asociaciones (
    id              UNIQUEIDENTIFIER DEFAULT NEWID() PRIMARY KEY,
    usuario_id      UNIQUEIDENTIFIER NOT NULL REFERENCES usuarios(id),
    nombre          NVARCHAR(200) NOT NULL,
    rnc             NVARCHAR(20) UNIQUE,
    direccion       NVARCHAR(300),
    telefono        NVARCHAR(20),
    logo_url        NVARCHAR(500),
    estado          NVARCHAR(20) DEFAULT 'PENDIENTE',  -- PENDIENTE, ACTIVA, SUSPENDIDA
    comision_pct    DECIMAL(5,2) DEFAULT 15.00,        -- % que retiene la plataforma
    fecha_aprobacion DATETIME2,
    aprobado_por    UNIQUEIDENTIFIER REFERENCES usuarios(id),
    fecha_creacion  DATETIME2 DEFAULT GETDATE()
);

CREATE TABLE conductores (
    id              UNIQUEIDENTIFIER DEFAULT NEWID() PRIMARY KEY,
    usuario_id      UNIQUEIDENTIFIER NOT NULL REFERENCES usuarios(id),
    asociacion_id   UNIQUEIDENTIFIER NOT NULL REFERENCES asociaciones(id),
    licencia_numero NVARCHAR(50) NOT NULL UNIQUE,
    licencia_vence  DATE NOT NULL,
    foto_url        NVARCHAR(500),
    calificacion_promedio DECIMAL(3,2) DEFAULT 0.00,
    total_viajes    INT DEFAULT 0,
    cuenta_bancaria NVARCHAR(30),
    banco           NVARCHAR(100),
    activo          BIT DEFAULT 1,
    fecha_creacion  DATETIME2 DEFAULT GETDATE()
);

-- ============================================================
-- MÓDULO 3: Pasajeros y Wallet
-- ============================================================

CREATE TABLE pasajeros (
    id              UNIQUEIDENTIFIER DEFAULT NEWID() PRIMARY KEY,
    usuario_id      UNIQUEIDENTIFIER NOT NULL REFERENCES usuarios(id),
    foto_url        NVARCHAR(500),
    viajes_realizados INT DEFAULT 0,
    fecha_creacion  DATETIME2 DEFAULT GETDATE()
);

CREATE TABLE wallet_pasajeros (
    id              UNIQUEIDENTIFIER DEFAULT NEWID() PRIMARY KEY,
    pasajero_id     UNIQUEIDENTIFIER NOT NULL UNIQUE REFERENCES pasajeros(id),
    saldo_viajes    INT DEFAULT 0,      -- cantidad de viajes disponibles
    saldo_dinero    DECIMAL(10,2) DEFAULT 0.00,
    fecha_actualizacion DATETIME2 DEFAULT GETDATE()
);

CREATE TABLE paquetes_viaje (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    nombre          NVARCHAR(100) NOT NULL,
    cantidad_viajes INT NOT NULL,
    precio          DECIMAL(10,2) NOT NULL,
    viajes_bono     INT DEFAULT 0,
    activo          BIT DEFAULT 1,
    fecha_creacion  DATETIME2 DEFAULT GETDATE()
);

CREATE TABLE transacciones (
    id              UNIQUEIDENTIFIER DEFAULT NEWID() PRIMARY KEY,
    pasajero_id     UNIQUEIDENTIFIER NOT NULL REFERENCES pasajeros(id),
    tipo            NVARCHAR(30) NOT NULL,  -- RECARGA, ABORDAJE, DEVOLUCION
    monto           DECIMAL(10,2),
    viajes_cantidad INT DEFAULT 0,
    referencia_externa NVARCHAR(200),       -- ID de pasarela de pago
    estado          NVARCHAR(20) DEFAULT 'PENDIENTE',
    descripcion     NVARCHAR(300),
    fecha_creacion  DATETIME2 DEFAULT GETDATE()
);

-- ============================================================
-- MÓDULO 4: Buses y Flota
-- ============================================================

CREATE TABLE buses (
    id              UNIQUEIDENTIFIER DEFAULT NEWID() PRIMARY KEY,
    asociacion_id   UNIQUEIDENTIFIER NOT NULL REFERENCES asociaciones(id),
    placa           NVARCHAR(20) NOT NULL UNIQUE,
    modelo          NVARCHAR(100),
    marca           NVARCHAR(100),
    anno            INT,
    capacidad_total INT NOT NULL,
    foto_url        NVARCHAR(500),
    activo          BIT DEFAULT 1,
    fecha_creacion  DATETIME2 DEFAULT GETDATE()
);

-- ============================================================
-- MÓDULO 5: Rutas y Paradas (con datos geoespaciales)
-- ============================================================

CREATE TABLE rutas (
    id              UNIQUEIDENTIFIER DEFAULT NEWID() PRIMARY KEY,
    asociacion_id   UNIQUEIDENTIFIER NOT NULL REFERENCES asociaciones(id),
    nombre          NVARCHAR(200) NOT NULL,
    codigo          NVARCHAR(20),
    descripcion     NVARCHAR(500),
    tarifa          DECIMAL(10,2) NOT NULL,
    activa          BIT DEFAULT 1,
    -- geography type para la polyline de la ruta completa (WKT LINESTRING)
    polyline        geography,
    fecha_creacion  DATETIME2 DEFAULT GETDATE()
);
CREATE INDEX IX_rutas_asociacion ON rutas(asociacion_id);
CREATE SPATIAL INDEX IX_rutas_polyline ON rutas(polyline) USING GEOGRAPHY_GRID;

CREATE TABLE paradas (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    ruta_id         UNIQUEIDENTIFIER NOT NULL REFERENCES rutas(id) ON DELETE CASCADE,
    nombre          NVARCHAR(200) NOT NULL,
    orden           INT NOT NULL,
    -- geography::Point para ubicación geoespacial de la parada
    ubicacion       geography NOT NULL,
    referencia      NVARCHAR(300),        -- descripción de referencia "Frente al parque"
    es_terminal     BIT DEFAULT 0
);
-- Índice espacial sobre las paradas para búsqueda por proximidad
CREATE SPATIAL INDEX IX_paradas_ubicacion ON paradas(ubicacion) USING GEOGRAPHY_GRID
    WITH (BOUNDING_BOX = (XMIN = -180, YMIN = -90, XMAX = 180, YMAX = 90));
CREATE INDEX IX_paradas_ruta ON paradas(ruta_id);

CREATE TABLE horarios (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    ruta_id         UNIQUEIDENTIFIER NOT NULL REFERENCES rutas(id) ON DELETE CASCADE,
    dias_semana     NVARCHAR(20) NOT NULL,  -- 'LMXJVSD' cada carácter = día activo
    hora_inicio     TIME NOT NULL,
    hora_fin        TIME NOT NULL,
    frecuencia_min  INT DEFAULT 30          -- cada cuántos minutos sale un bus
);

CREATE TABLE asignaciones_bus_ruta (
    id              UNIQUEIDENTIFIER DEFAULT NEWID() PRIMARY KEY,
    ruta_id         UNIQUEIDENTIFIER NOT NULL REFERENCES rutas(id),
    bus_id          UNIQUEIDENTIFIER NOT NULL REFERENCES buses(id),
    conductor_id    UNIQUEIDENTIFIER NOT NULL REFERENCES conductores(id),
    activa          BIT DEFAULT 1,
    fecha_inicio    DATE NOT NULL,
    fecha_fin       DATE
);

-- ============================================================
-- MÓDULO 6: Viajes activos (tracking en tiempo real)
-- ============================================================

CREATE TABLE viajes (
    id              UNIQUEIDENTIFIER DEFAULT NEWID() PRIMARY KEY,
    asignacion_id   UNIQUEIDENTIFIER NOT NULL REFERENCES asignaciones_bus_ruta(id),
    conductor_id    UNIQUEIDENTIFIER NOT NULL REFERENCES conductores(id),
    bus_id          UNIQUEIDENTIFIER NOT NULL REFERENCES buses(id),
    ruta_id         UNIQUEIDENTIFIER NOT NULL REFERENCES rutas(id),
    estado          NVARCHAR(20) DEFAULT 'PROGRAMADO',  -- PROGRAMADO, EN_CURSO, FINALIZADO, CANCELADO
    asientos_disponibles INT NOT NULL,
    fecha_inicio    DATETIME2,
    fecha_fin       DATETIME2,
    -- Posición actual del bus (actualizada cada 5 seg via WebSocket)
    posicion_actual geography,
    fecha_posicion  DATETIME2,
    ingreso_total   DECIMAL(10,2) DEFAULT 0.00,
    fecha_creacion  DATETIME2 DEFAULT GETDATE()
);
CREATE SPATIAL INDEX IX_viajes_posicion ON viajes(posicion_actual) USING GEOGRAPHY_GRID;
CREATE INDEX IX_viajes_estado ON viajes(estado);
CREATE INDEX IX_viajes_ruta ON viajes(ruta_id);

-- ============================================================
-- MÓDULO 7: Reservas
-- ============================================================

CREATE TABLE reservas (
    id              UNIQUEIDENTIFIER DEFAULT NEWID() PRIMARY KEY,
    pasajero_id     UNIQUEIDENTIFIER NOT NULL REFERENCES pasajeros(id),
    viaje_id        UNIQUEIDENTIFIER NOT NULL REFERENCES viajes(id),
    parada_origen_id INT NOT NULL REFERENCES paradas(id),
    parada_destino_id INT NOT NULL REFERENCES paradas(id),
    estado          NVARCHAR(20) DEFAULT 'PROVISIONAL',  -- PROVISIONAL, CONFIRMADA, ABORDADA, EXPIRADA, CANCELADA
    qr_token        NVARCHAR(500) UNIQUE NOT NULL,        -- JWT firmado para escaneo
    qr_expira_en    DATETIME2 NOT NULL,
    numero_asiento  INT,
    -- Ubicación del pasajero al momento de reservar
    ubicacion_pasajero geography,
    fecha_creacion  DATETIME2 DEFAULT GETDATE(),
    fecha_abordaje  DATETIME2
);
CREATE INDEX IX_reservas_pasajero ON reservas(pasajero_id);
CREATE INDEX IX_reservas_viaje ON reservas(viaje_id);
CREATE INDEX IX_reservas_estado ON reservas(estado);
CREATE INDEX IX_reservas_qr ON reservas(qr_token);

-- ============================================================
-- MÓDULO 8: Abordajes (registro definitivo al subir)
-- ============================================================

CREATE TABLE abordajes (
    id              UNIQUEIDENTIFIER DEFAULT NEWID() PRIMARY KEY,
    reserva_id      UNIQUEIDENTIFIER NOT NULL REFERENCES reservas(id),
    pasajero_id     UNIQUEIDENTIFIER NOT NULL REFERENCES pasajeros(id),
    viaje_id        UNIQUEIDENTIFIER NOT NULL REFERENCES viajes(id),
    conductor_id    UNIQUEIDENTIFIER NOT NULL REFERENCES conductores(id),
    numero_asiento  INT NOT NULL,
    monto_cobrado   DECIMAL(10,2) NOT NULL,
    tipo_pago       NVARCHAR(20) NOT NULL,  -- SALDO_VIAJES, SALDO_DINERO
    ticket_codigo   NVARCHAR(50) UNIQUE NOT NULL,
    fecha_abordaje  DATETIME2 DEFAULT GETDATE()
);
CREATE INDEX IX_abordajes_viaje ON abordajes(viaje_id);

-- ============================================================
-- MÓDULO 9: Liquidaciones al Conductor
-- ============================================================

CREATE TABLE liquidaciones (
    id              UNIQUEIDENTIFIER DEFAULT NEWID() PRIMARY KEY,
    conductor_id    UNIQUEIDENTIFIER NOT NULL REFERENCES conductores(id),
    viaje_id        UNIQUEIDENTIFIER REFERENCES viajes(id),
    periodo_inicio  DATE NOT NULL,
    periodo_fin     DATE NOT NULL,
    total_abordajes INT DEFAULT 0,
    ingreso_bruto   DECIMAL(10,2) DEFAULT 0.00,
    comision_plataforma DECIMAL(10,2) DEFAULT 0.00,
    comision_asociacion DECIMAL(10,2) DEFAULT 0.00,
    monto_neto      DECIMAL(10,2) DEFAULT 0.00,
    estado          NVARCHAR(20) DEFAULT 'PENDIENTE',  -- PENDIENTE, PAGADA, EN_PROCESO
    referencia_pago NVARCHAR(200),
    fecha_pago      DATETIME2,
    fecha_creacion  DATETIME2 DEFAULT GETDATE()
);

CREATE TABLE config_comisiones (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    nombre          NVARCHAR(100) NOT NULL,
    pct_plataforma  DECIMAL(5,2) NOT NULL DEFAULT 10.00,
    pct_asociacion  DECIMAL(5,2) NOT NULL DEFAULT 5.00,
    activo          BIT DEFAULT 1,
    fecha_desde     DATE NOT NULL,
    fecha_hasta     DATE
);

-- ============================================================
-- MÓDULO 10: Calificaciones
-- ============================================================

CREATE TABLE calificaciones (
    id              UNIQUEIDENTIFIER DEFAULT NEWID() PRIMARY KEY,
    abordaje_id     UNIQUEIDENTIFIER NOT NULL UNIQUE REFERENCES abordajes(id),
    pasajero_id     UNIQUEIDENTIFIER NOT NULL REFERENCES pasajeros(id),
    conductor_id    UNIQUEIDENTIFIER NOT NULL REFERENCES conductores(id),
    estrellas       TINYINT NOT NULL CHECK (estrellas BETWEEN 1 AND 5),
    comentario      NVARCHAR(500),
    fecha_creacion  DATETIME2 DEFAULT GETDATE()
);

-- ============================================================
-- Datos semilla iniciales
-- ============================================================

INSERT INTO roles (nombre, descripcion) VALUES
('admin',       'Administrador del sistema'),
('asociacion',  'Asociación de conductores'),
('conductor',   'Conductor de autobus'),
('pasajero',    'Pasajero usuario de la app');

INSERT INTO paquetes_viaje (nombre, cantidad_viajes, precio, viajes_bono) VALUES
('Paquete Básico',    10,  250.00, 0),
('Paquete Estándar',  25,  550.00, 2),
('Paquete Premium',   50, 1000.00, 5),
('Paquete Mensual',  100, 1800.00, 10);

INSERT INTO config_comisiones (nombre, pct_plataforma, pct_asociacion, activo, fecha_desde) VALUES
('Tarifa estándar 2024', 10.00, 5.00, 1, '2024-01-01');

GO
