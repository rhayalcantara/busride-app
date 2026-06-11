# BusRide — Verificación por olas

## Ola 2 — T-04 (Integración base + hardening de Auth)

> Fecha: 2026-06-10 · Entorno: Windows 11, Node 24, Docker Desktop (WSL2), SQL Server 2022 en contenedor `busride_sqlserver`.

### Build y lint

- `npm run build` — ✅ en verde.
- `npm run lint` — ✅ en verde (1 warning preexistente en `src/modules/buses/tracking.gateway.ts`, propiedad de T-11).

### Preparación de la BD (con hallazgos de infraestructura)

1. `docker compose up -d sqlserver` — contenedor nuevo, volumen `busride-app_sqlserver_data` creado.
2. **Hallazgo INF-1**: la imagen `mcr.microsoft.com/mssql/server:2022-latest` NO ejecuta `/docker-entrypoint-initdb.d` (el montaje en `docker-compose.yml` es decorativo). Los scripts se ejecutaron manualmente:
   ```
   docker exec busride_sqlserver /opt/mssql-tools18/bin/sqlcmd -C -I -S localhost -U sa -P '***' -i /docker-entrypoint-initdb.d/01_create_database.sql
   docker exec busride_sqlserver /opt/mssql-tools18/bin/sqlcmd -C -I -S localhost -U sa -P '***' -i /docker-entrypoint-initdb.d/02_schema.sql
   docker exec busride_sqlserver /opt/mssql-tools18/bin/sqlcmd -C -I -S localhost -U sa -P '***' -i /docker-entrypoint-initdb.d/03_stored_procedures.sql
   ```
3. **Hallazgo INF-2**: el healthcheck del compose usa `/opt/mssql-tools/bin/sqlcmd`, pero en la imagen 2022 actual la ruta es `/opt/mssql-tools18/bin/sqlcmd` (y requiere `-C` por TLS) → el contenedor nunca llega a `healthy` y `depends_on: condition: service_healthy` del servicio backend jamás se cumpliría.
4. **Hallazgo INF-3 (bug en `02_schema.sql`, corregido en este commit)**: `CREATE SPATIAL INDEX IX_paradas_ubicacion ... USING GEOGRAPHY_GRID WITH (BOUNDING_BOX = ...)` fallaba con `Msg 12005` — `BOUNDING_BOX` solo es válido para `GEOMETRY_GRID`. Se eliminó la cláusula. Además los índices espaciales exigen `QUOTED_IDENTIFIER ON` (de ahí el flag `-I` de sqlcmd; sería más robusto añadir `SET QUOTED_IDENTIFIER ON` al inicio del script).
5. **Hallazgo INF-4 (bug en `backend/src/config/database.config.ts`)**: `configService.get<number>('DB_PORT', 1433)` devuelve **string** cuando la variable viene de `.env`, y tedious lanza `The "config.options.port" property must be of type number`. Workaround aplicado: `DB_PORT` comentado en `backend/.env` (aplica el default numérico 1433). Corregir con `parseInt` en T-12/T-16 (misma revisión para `config/data-source.ts`).
6. Resultado final: BD `busride_db` con **20 tablas**, **7 stored procedures** y seeds (`roles`: 1=admin, 2=asociacion, 3=conductor, 4=pasajero).
7. Notas de entorno (no del repo): Docker Desktop se caía por presión de memoria de WSL2 (se creó `%USERPROFILE%\.wslconfig` con `memory=4GB`); los puertos 3000/3001 del host estaban ocupados por otro contenedor ajeno al proyecto, por lo que la app se levantó con `PORT=3002` en `backend/.env`.

### Flujo verificado (app levantada con `node dist/main.js`, base `http://localhost:3002/api/v1`)

1) `POST /auth/registrar` con rol pasajero:
```
curl -X POST $BASE/auth/registrar -H 'Content-Type: application/json' \
  -d '{"email":"pasajero.t04@busride.do","password":"Secreta123!","nombre":"Pedro","apellido":"Prueba","rolId":4}'
→ HTTP 201 {"mensaje":"Usuario registrado. Verifica tu email para activar la cuenta.","usuarioId":"7A4090A0-5F8D-4B85-A22B-C8523E1E47B7"}
```
   - Registro duplicado → HTTP 409 `El email ya está registrado`.
   - DTO inválido (email malo, password corta, nombre vacío) → HTTP 400 con los tres mensajes de class-validator (F2 resuelto en auth).
   - Verificación en BD (F8 resuelto) — el registro creó las TRES filas en una transacción:
```
SELECT u.email, u.rol_id, p.id, w.saldo_viajes, w.saldo_dinero
FROM usuarios u JOIN pasajeros p ON p.usuario_id = u.id JOIN wallet_pasajeros w ON w.pasajero_id = p.id
WHERE u.email = 'pasajero.t04@busride.do';
→ pasajero.t04@busride.do | 4 | DD59AB91-3606-4C05-974D-7F6556DF205E | saldo_viajes=0 | saldo_dinero=0.00
```

2) `POST /auth/login`:
```
curl -X POST $BASE/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"pasajero.t04@busride.do","password":"Secreta123!"}'
→ HTTP 200 { "accessToken":"eyJ...", "refreshToken":"e93bf102c4b7...(96 hex)", "usuario":{ "id":"7A40...","rol":"pasajero", ... } }
```
   - El refresh token es un string opaco de `crypto.randomBytes(48)` (NO un JWT); en `tokens_refresco` solo se guarda su hash sha256 (64 hex) con expiración a 7 días.

3) `POST /auth/refresh` (rotación):
```
curl -X POST $BASE/auth/refresh -H 'Content-Type: application/json' -d '{"refreshToken":"e93bf102c4b7..."}'
→ HTTP 200 { "accessToken":"eyJ...(nuevo)", "refreshToken":"f4a7af92c63f...(nuevo)" }
```
   - Reuso del refresh viejo (ya rotado) → HTTP 401 `Refresh token inválido o expirado`. ✅ Rotación verificada.

4) `POST /auth/logout` con `Authorization: Bearer <accessToken nuevo>`:
```
→ HTTP 200 {"mensaje":"Sesión cerrada. Refresh tokens revocados."}
```
   - Sin token → HTTP 401.

5) `POST /auth/refresh` con el refresh revocado por logout → HTTP 401. ✅ (F6 resuelto)

Estado final en BD:
```
SELECT LEFT(token,12), LEN(token), revocado, expira_en FROM tokens_refresco;
→ 2 filas, LEN=64 (sha256 hex), revocado=1 ambas, expira_en=2026-06-17 (7 días)
```

La app se detuvo al terminar (puerto 3002 liberado). El contenedor `busride_sqlserver` queda corriendo.

### Decisiones de diseño

- **RolesGuard global** registrado como `APP_GUARD` en `AppModule`: solo actúa cuando hay metadata `@Roles(...)`; sin ella es un no-op, así los endpoints actuales no cambian. **Advertencia documentada en el código**: los guards globales corren ANTES que los `@UseGuards` de controlador, así que cuando Ola 3 introduzca `@Roles`, esos endpoints responderán 403 (fail-closed) hasta que T-12 haga global el `JwtAuthGuard` con un decorador `@Public` para los endpoints de auth.
- El refresh token expira a los 7 días (configurable con `REFRESH_TOKEN_DIAS`).
- `logout` revoca TODOS los refresh tokens vigentes del usuario (cierre de sesión global).
- Al registrar con rol **conductor** NO se crea fila en `conductores` (requiere datos de licencia; lo hará el módulo conductores en Ola 3).

---

## Ola 4 — T-12 (Integración de dominio)

> Fecha: 2026-06-10 · Entorno: Windows 11, Node 24, contenedor `busride_sqlserver` con la BD poblada de la Ola 2, app local en `PORT=3002` (`node dist/main.js`). Base: `http://localhost:3002/api/v1`.

### Integración realizada

1. **Módulos registrados en `AppModule`**: `UsuariosModule`, `AsociacionesModule`, `ConductoresModule`, `FlotaModule` y `ScheduleModule.forRoot()` (activa `ReservasCronService`; verificado en logs: `EXEC sp_expirar_reservas` corre cada minuto).
2. **Cadena de guards globales** (el orden de providers `APP_GUARD` determina la ejecución):
   - `JwtAuthGuard` (global, 1º): exige Bearer token y puebla `request.user`. Excepciones: metadata `@Public()` (nuevo decorador en `src/common/decorators/public.decorator.ts`, aplicado a `POST /auth/login`, `POST /auth/registrar`, `POST /auth/refresh`) y contextos no-HTTP (`context.getType() !== 'http'` → `true`, para no romper los gateways WS; el tracking se protege con su `WsJwtGuard` por mensaje). Handshake Socket.IO verificado tras el cambio (`GET /socket.io/?EIO=4&transport=polling` → sid).
   - `RolesGuard` (global, 2º): sin cambios; ahora siempre ve `request.user`. La advertencia fail-closed de T-04 quedó obsoleta y se eliminó del comentario de `app.module.ts`.
3. **JwtModule único y global**: `JwtModule.registerAsync({ global: true, ... })` en `AuthModule`; se eliminaron los `registerAsync` duplicados de `ReservasModule` y `ViajesModule` (firmado de QR y `WsJwtGuard` siguen funcionando — verificado en el smoke-test).
4. **INF-1 resuelto — init de BD automatizado**:
   - Nuevo `database/init.sh`: corre dentro de un contenedor mssql con `sqlcmd -C -I -b`, espera a que el server responda, ejecuta `01` (idempotente per se), `02` solo si la BD no tiene la tabla `roles` (el schema no es re-ejecutable) y `03` siempre (`CREATE OR ALTER`). Detecta `mssql-tools18` o `mssql-tools`. Guardado con LF (`database/.gitattributes` lo fija para `core.autocrlf=true`).
   - Nuevo servicio one-shot `sqlserver-init` en `docker-compose.yml` (imagen mssql con `entrypoint` override) que depende del healthcheck de `sqlserver`; el `backend` ahora también depende de `sqlserver-init: service_completed_successfully`.
   - **Probado** contra el contenedor existente sin recrearlo: `docker exec -i busride_sqlserver bash < database/init.sh` → `01` OK, `02` omitido (schema presente), `03` re-aplicado. `docker compose config` válido. El camino "BD desde cero" del servicio compose no se ejecutó para no recrear el contenedor en uso (su healthcheck es el viejo, anterior al fix de la Ola 2; al recrearlo tomará el nuevo y `sqlserver-init` correrá solo).
5. **Hallazgos de BD de T-10 aplicados** (en `02_schema.sql` y en la BD viva con sqlcmd):
   - `CREATE UNIQUE INDEX UQ_transacciones_ref_externa ON transacciones(pasajero_id, referencia_externa) WHERE referencia_externa IS NOT NULL AND estado = 'COMPLETADA'` (idempotencia de compras).
   - `IX_transacciones_pasajero` (apoyo a historial).
   - Pendiente (opcional, para T-16): CHECK constraints de `transacciones.tipo/estado` contra los enums.

### Bugs de integración corregidos sobre la marcha

Todos eran desajustes **entidad TypeORM ↔ schema real** heredados del esqueleto (las columnas geography no se mapean, pero las entidades declaraban columnas planas que NO existen en la BD). Salían como 500 (`Invalid column name ...`) en cuanto el repo tocaba la tabla:

| # | Archivo | Problema | Fix |
|---|---|---|---|
| B1 | `rutas/entities/ruta.entity.ts` | `@Column polylineWkt` — la tabla `rutas` solo tiene `polyline geography` | Propiedad de transporte sin `@Column` |
| B2 | `rutas/entities/parada.entity.ts` | `@Column lat/lng` — `paradas` solo tiene `ubicacion geography` | Propiedades de transporte sin `@Column` |
| B3 | `rutas/rutas.service.ts` (`crearRuta`) | `repo.create({...data})` intentaba persistir `paradas` (cascade con `ubicacion NOT NULL`) y `polylineWkt` | Se excluyen del save; las paradas se insertan con SQL crudo como ya hacía |
| B4 | `reservas/entities/reserva.entity.ts` | `@Column lat_pasajero/lng_pasajero` — `reservas` solo tiene `ubicacion_pasajero geography` | Propiedades de transporte sin `@Column` |
| B5 | `flota/flota.service.ts` (`crearBus`) | `SELECT ... FROM asociaciones WHERE activa = 1` — la tabla no tiene `activa`, usa `estado` | `WHERE estado = 'ACTIVA'` |
| B6 | `database/init/02_schema.sql` + BD viva | `viajes` sin `pos_lat`/`pos_lng`, pero la entidad `Viaje` y el SQL crudo de `actualizarPosicion` (código original) las escriben/leen | Columnas `FLOAT NULL` añadidas al schema y con `ALTER TABLE` a la BD viva |

### Smoke-test end-to-end (todo ✅, corrida `t12d`)

Usuarios `*.t12d@busride.do` (password `Secreta123!`), rolId según seeds (1=admin, 2=asociacion, 3=conductor, 4=pasajero).

| Paso | Request | Resultado |
|---|---|---|
| a | `POST /auth/registrar` ×4 + `POST /auth/login` ×4 | 201/200; tokens emitidos, `usuario.rol` correcto |
| b | admin `POST /asociaciones` (vincula usuario rol asociacion) → `PATCH /asociaciones/:id/aprobar` | 201 estado PENDIENTE → 200 estado ACTIVA con `aprobadoPor` |
| c | admin `POST /rutas` (3 paradas con lat/lng, geography vía SQL) → `GET /rutas/:id/paradas` | 201; paradas con lat/lng leídas de `ubicacion.Lat/Long` |
| c | asociacion `POST /flota/buses` (cap. 30) · `POST /conductores` (alta con licencia) · `POST /flota/asignaciones` (bus+ruta+conductor) | 201 ×3 |
| d | pasajero `POST /wallet/comprar {paqueteId:1, referenciaExterna:"PAY-t12d-0001"}` | 201 `saldoViajes: 0→10` |
| d | repetir la MISMA `referenciaExterna` | 201 `{idempotente:true}`, saldo sigue en 10 (índice único + lógica T-10) ✅ |
| e | conductor `POST /viajes/iniciar {asignacionId}` → `GET /viajes/mi-activo` → `PATCH /viajes/:id/posicion` | 201 EN_CURSO, 30 asientos; mi-activo lo devuelve; posición actualizada (geography + pos_lat/lng) |
| d2 | pasajero `GET /rutas/buscar?latOrigen=...` (sp_buscar_rutas_disponibles) | 200, 1 resultado: el viaje EN_CURSO con paradas origen/destino y distancias |
| f | pasajero `POST /reservas` | 201: `reservaId`, `qrToken` (JWT 5 min) e imagen QR base64 · `GET /reservas/mias` → 200 (1 reserva) |
| g | conductor `POST /reservas/abordar {qrToken, numeroAsiento:5}` | 201: ticket `TK-...`, monto 50, asientos 30→29, saldo del pasajero descontado por el SP |
| h | conductor `POST /viajes/:id/finalizar` | 201: `{total_pasajeros:1, ingreso_bruto:50, comision_plataforma:5, comision_asociacion:2.5, monto_neto_conductor:42.5}` |
| h | conductor `GET /liquidaciones/mias` | 200 con la liquidación PENDIENTE del viaje |
| x | pasajero `POST /conductores/:id/calificar {viajeId, estrellas:5}` | 201; valida abordaje previo y recalcula promedio vía SP |
| i | `GET /reservas/mias` y `GET /wallet/mi-saldo` **sin token** | 401 ✅ |
| i | pasajero `POST /viajes/iniciar` | 403 ✅ (RolesGuard) |
| i | conductor `GET /usuarios` | 403 ✅ · admin `GET /usuarios` → 200 ✅ |

### Cierre

- `npm run build` ✅ · `npm run lint` ✅ · `npx jest --passWithNoTests` ✅ (aún sin specs — Ola 5).
- App detenida al terminar; `busride_sqlserver` queda corriendo con la BD poblada (incluye los datos de las corridas de smoke `t12a`–`t12d`).
- Hallazgo menor (para Ola 5/6): `POST /rutas` sigue con `@Body() body: any` (sin DTO de clase ni `@Roles`) — cualquier usuario autenticado puede crear rutas; el módulo rutas no fue endurecido por ninguna tarea de la Ola 3.

---

## Ola 6 — T-16 (Bugs B1-B6, BD, docs y verificación final)

> Fecha: 2026-06-10 · Entorno: Windows 11, Node 24, contenedor `busride_sqlserver` con la BD poblada, app local en `PORT=3002`.

### Bugs corregidos (reportados por la Ola 5)

| Bug | Fix | Archivos |
|---|---|---|
| **B1** Escalada de privilegios en registro | `POST /auth/registrar` ya solo crea PASAJEROS: `RegistrarDto` sin `rolId` (enviarlo → 400 por `forbidNonWhitelisted`); el rol se resuelve por nombre en el service. Nuevo `POST /auth/usuarios` `@Roles(admin)` con `CrearUsuarioDto` para crear cualquier rol. Primer admin sembrado por `database/init/04_seed_admin.sql` (`admin@busride.do` / `Admin123!cambiar`, **cambiar en producción**), integrado en `init.sh` (paso 04) y aplicado a la BD viva. | `auth.service.ts`, `auth.controller.ts`, `dto/registrar.dto.ts`, `dto/crear-usuario.dto.ts` (nuevo), `database/init/04_seed_admin.sql` (nuevo), `database/init.sh` |
| **B2** IDOR en `iniciarViaje` | La query de la asignación ahora trae `a.conductor_id` y se compara con el conductor del JWT → `ForbiddenException` (403) si es ajena. Se eligió comparar en TS (en vez de `AND a.conductor_id = @1`) para distinguir 403 (ajena) de 400 (inexistente/inactiva). `it.skip` eliminado + e2e nuevo (5b en flujo-completo). | `viajes.service.ts`, `viajes.service.spec.ts`, `test/flujo-completo.e2e-spec.ts` |
| **B3** ThrottlerGuard sin vincular | Nuevo `ThrottlerHttpGuard` (extiende `ThrottlerGuard`; `true` en contextos no-HTTP para no romper los gateways WS) registrado como **primer** `APP_GUARD` — antes de `JwtAuthGuard`, así el rate limit también cubre login/registrar. Límites por env: `THROTTLE_LIMIT` (100) / `THROTTLE_TTL_MS` (60000); los e2e fijan `THROTTLE_LIMIT=10000` en `e2e.helpers.ts` antes de compilar el AppModule (dotenv no pisa env ya definidas). | `common/guards/throttler-http.guard.ts` (nuevo), `app.module.ts`, `test/utils/e2e.helpers.ts`, `.env.example` |
| **B4** RNC duplicado 400→409 | `ConflictException` en `crear()` y `actualizar()`; `it.skip` eliminado y test de `actualizar` ajustado a 409. | `asociaciones.service.ts`, `asociaciones.service.spec.ts` |
| **B5** Recordset vacío del SP | `crearReserva`, `confirmarAbordaje` y `finalizarViaje` lanzan `BadRequestException('El procedimiento ... no devolvió resultado')` si el SP no devuelve filas (antes: TypeError → 500). +3 tests unitarios. | `reservas.service.ts`, `viajes.service.ts`, sus specs |
| **B6** GETs de flota con IDs ajenos | Parcial, decidido: nuevo `GET /flota/asignaciones/mias` (`@Roles(conductor)`, identidad del JWT) para la app del conductor; `GET /flota/asignaciones/conductor/:id` restringido a `@Roles(admin, asociacion)`. `GET /flota/buses/asociacion/:id` se mantiene abierto a cualquier autenticado — decisión documentada en el controller: lectura no sensible (equiparable al listado público de asociaciones) y el IDOR explotable quedó cerrado en B2. | `flota.controller.ts`, `flota.service.ts` |

### Pendiente de BD aplicado

Valores verificados antes de crear los CHECK: el código usa `TipoTransaccion = RECARGA|ABORDAJE|DEVOLUCION` y `EstadoTransaccion = PENDIENTE|COMPLETADA`; `sp_confirmar_abordaje` inserta `('ABORDAJE','COMPLETADA')`; la BD viva solo contenía `RECARGA/ABORDAJE + COMPLETADA`. Aplicado en `02_schema.sql` y en la BD viva con sqlcmd (**WITH CHECK** — sin datos legacy que lo violen; ambos constraints quedaron `is_not_trusted = 0`):

```sql
ALTER TABLE transacciones ADD CONSTRAINT CK_transacciones_tipo  CHECK (tipo  IN ('RECARGA','ABORDAJE','DEVOLUCION'));
ALTER TABLE transacciones ADD CONSTRAINT CK_transacciones_estado CHECK (estado IN ('PENDIENTE','COMPLETADA'));
```

### Documentación

- `README.md` (raíz, nuevo): qué es BusRide, stack, arranque con/sin Docker (rol de `sqlserver-init`), comandos, mapa de endpoints por módulo con roles, Swagger, sección de seguridad.
- `CLAUDE.md`: actualizado (módulos completos, cadena de guards globales Throttler→Jwt→Roles, DTOs clase en `dto/`, comandos de test unit+e2e, init de BD vía `sqlserver-init`/`init.sh`, registro público solo pasajero, entry point `dist/src/main.js`).
- `backend/.env.example`: añadidas `REFRESH_TOKEN_DIAS`, `THROTTLE_LIMIT`, `THROTTLE_TTL_MS` con comentarios.
- `TAREAS.md` (T-16 ✅ + nota de cierre) y `PLAN.md` (estado por F# + sección "Estado final 2026-06-10").

### Verificación final (criterio de aceptación)

| Paso | Resultado |
|---|---|
| `npm run build` | ✅ |
| `npm run lint` | ✅ |
| `npx jest` (unit) | ✅ **11 suites, 120 tests, 0 skip** (los 2 `it.skip` de B2/B4 eliminados al corregirse) |
| `npx jest --config test/jest-e2e.json --runInBand` | ✅ **3 suites, 47 tests** (42 previos adaptados al nuevo registro + 5 nuevos: rolId→400, /auth/usuarios 401/403/201, IDOR B2) |
| Bootstrap | ✅ `node dist/src/main.js` con `PORT=3002`: login del admin seed → 200 (`rol=admin`), Swagger `/api/docs` → 200; proceso detenido al terminar |

El contenedor `busride_sqlserver` queda corriendo con la BD poblada (ahora incluye el admin seed y los CHECK constraints). Sin procesos node residuales.

### Pendiente para el futuro

- Frontend, uso real de Redis (F13) y migraciones TypeORM formales (F14) — fuera de alcance, ver `PLAN.md` §4.
- Forzar cambio de password del admin seed en producción (hoy solo documentado).
- `handleConnection` del gateway WS sigue abierto (los mensajes sí exigen JWT) — endurecer si se publica.
