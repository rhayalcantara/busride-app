# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

The git root is `C:\BusRides\busride-app`. The actual project lives one level deeper in `busride-app/`:

- `busride-app/backend/` — NestJS 10 API (all application code; run `npm` commands from here)
- `busride-app/database/init/` — SQL Server schema + stored procedures, run on container init
- `busride-app/docker-compose.yml` — SQL Server 2022, Redis 7, and the backend

BusRide is a bus-routing and boarding platform (Spanish-language domain: rutas, paradas, viajes, reservas, abordajes, liquidaciones). Code identifiers, comments, and API messages are in Spanish — match that convention.

## Commands

All run from `busride-app/backend/`:

- `npm run start:dev` — watch-mode dev server (Swagger at `/api/docs`, API under `/api/v1`)
- `npm run build` / `npm run start:prod` — compile to `dist/` and run (entry point is `dist/src/main.js`)
- `npm run lint` — ESLint with `--fix`
- `npx jest` — unit tests; single file: `npx jest reservas.service.spec`
- `npx jest --config test/jest-e2e.json --runInBand` — e2e tests (require the `busride_sqlserver` container with an initialized DB; they auto-raise `THROTTLE_LIMIT` and close the app in `afterAll`)
- `npm run migration:generate -- src/database/migrations/<Name>` — generate a TypeORM migration from entity changes
- `npm run migration:run` / `npm run migration:revert` — apply / undo migrations

Full stack via Docker (from `busride-app/`): `docker compose up`. The mssql image does NOT auto-run `/docker-entrypoint-initdb.d`; the one-shot `sqlserver-init` service runs `database/init.sh` (01 create DB → 02 schema → 03 SPs → 04 seed admin, idempotent) once `sqlserver` is healthy, and `backend` waits for it. Manual re-init: `docker exec -i busride_sqlserver bash < database/init.sh`. Copy `backend/.env.example` to `backend/.env` for local non-Docker runs. Seeded initial admin: `admin@busride.do` / `Admin123!cambiar` (change in production).

## Architecture

NestJS modular monolith over **SQL Server**, organized as feature modules under `backend/src/modules/` (`auth`, `usuarios`, `asociaciones`, `conductores`, `flota`, `rutas`, `reservas`, `buses` (viajes/tracking), `wallet`, `liquidaciones`). `AppModule` wires global config, TypeORM (via `getDatabaseConfig`), `ScheduleModule` (cron expiring reservations every minute), `ThrottlerModule` (limits configurable via `THROTTLE_LIMIT`/`THROTTLE_TTL_MS`), and registers every entity + business module. `main.ts` sets the `api/v1` global prefix, a strict global `ValidationPipe` (`whitelist` + `forbidNonWhitelisted` + `transform`), CORS, and Swagger.

**Global guard chain** (`APP_GUARD` providers in `AppModule`, order matters): `ThrottlerHttpGuard` (rate limit, HTTP only) → `JwtAuthGuard` (every route requires a Bearer token unless decorated `@Public()`) → `RolesGuard` (enforces `@Roles(...)` metadata against `request.user.rol`). All three return `true` for non-HTTP contexts so WS gateways are unaffected (tracking uses its own per-message `WsJwtGuard`). Shared decorators/guards live in `backend/src/common/`.

### The database is a first-class layer — not just persistence

This is the most important thing to understand. Core transactional and geospatial logic lives in **SQL Server stored procedures** (`database/init/03_stored_procedures.sql`), not in TypeScript. Services call them with raw parameterized queries (`dataSource.query('EXEC sp_... @0, @1', [...])`) and branch on a returned `{ exito, mensaje, ... }` shape, throwing `BadRequestException(res.mensaje)` when `exito` is false. Key SPs:

- `sp_buscar_rutas_disponibles` — geospatial route search by origin/destination radius
- `sp_crear_reserva` — provisional seat reservation
- `sp_confirmar_abordaje` — atomic QR validation + seat assignment + decrement availability
- `sp_liquidar_viaje` — settlement (splits fare into platform/association commissions)
- `sp_expirar_reservas`, `sp_pasajeros_en_parada`, `sp_actualizar_calificacion_conductor`

When changing reservation, boarding, settlement, or route-search behavior, the logic is usually in the SP, not the service. Update the SQL and keep the service's parameter mapping in sync.

### Geography columns

Tables (`paradas`, `viajes`, `rutas`) use SQL Server `geography` columns (`ubicacion`, `posicion_actual`, `polyline`) that **TypeORM entities do not map**. Entities store plain `lat`/`lng` floats; the `geography` columns are written and read with raw SQL using `geography::Point(lat, lng, 4326)` / `.Lat` / `.Long` / `STGeomFromText`. See `RutasService.crearRuta` and `ViajesService.actualizarPosicion` for the pattern — entity save + raw SQL for the geo column, wrapped in a `queryRunner` transaction.

### TypeORM usage

`synchronize` is **off** — the schema is owned by `database/init/02_schema.sql` and migrations. Entities use snake_case DB columns mapped to camelCase TS properties (`@Column({ name: 'pasajero_id' })`). Simple CRUD and relation loading go through repositories; anything transactional or geospatial uses `dataSource`/`queryRunner` raw queries. There are two near-identical datasource configs: `config/database.config.ts` (runtime, via Nest DI) and `config/data-source.ts` (TypeORM CLI for migrations) — keep them consistent.

### Auth and the QR boarding flow

JWT via Passport (`JwtStrategy` → `validate` returns `{ userId, email, rol }`). Auth is enforced globally (see guard chain above) — controllers only add `@Roles(...)` and read identity via `@CurrentUser()`; `pasajeroId`/`conductorId` are always derived from the JWT, never from params/body (anti-IDOR routes: `/mias`, `/mi-saldo`, `/mi-activo`). Passwords are bcrypt (cost 12). Login returns an access JWT plus an opaque refresh token (sha256 hash persisted in `tokens_refresco`, rotated on `/auth/refresh`, all revoked on logout). **Public registration (`POST /auth/registrar`) only creates pasajeros** (transactionally with their `pasajeros` + `wallet_pasajeros` rows); privileged roles are created via `POST /auth/usuarios` (admin only — first admin comes from `database/init/04_seed_admin.sql`). `JwtModule` is registered once, globally, in `AuthModule`.

The boarding QR is itself a short-lived signed JWT (5-min TTL), not a DB lookup token: `ReservasService.crearReserva` signs a `{ pasajeroId, viajeId, paradaOrigenId, tipo: 'ABORDAJE' }` payload, renders it to a base64 PNG with `qrcode`, and returns both. `confirmarAbordaje` verifies the JWT before calling `sp_confirmar_abordaje`. Note `ReservasModule` registers its own `JwtModule` with the same `JWT_SECRET`.

### Real-time tracking

`TrackingGateway` (Socket.IO, namespace `/tracking`) handles live bus tracking. Drivers emit `actualizar_posicion` (~every 5s) → the gateway persists via `ViajesService.actualizarPosicion` and broadcasts `posicion_bus` to the `viaje_<id>` room; passengers `suscribir_viaje`/`desuscribir_viaje` to join/leave that room. `emitirDisponibilidadActualizada` broadcasts seat-availability changes.

### Adding a feature module

Follow the existing shape: `modules/<feature>/` with `entities/`, `dto/`, `<feature>.service.ts`, `<feature>.controller.ts`, `<feature>.module.ts`, plus `<feature>.service.spec.ts` unit tests (repos/datasource mocked). DTOs are classes with `class-validator` decorators in `dto/` (the global ValidationPipe rejects unknown fields). Controllers are thin, annotated with `@ApiTags`/`@ApiOperation`/`@ApiBearerAuth` for Swagger, and use `@Roles(...)`/`@CurrentUser()` from `src/common`. Register new entities in both the feature module's `forFeature` and `AppModule`. E2e specs live in `backend/test/` and share helpers in `test/utils/e2e.helpers.ts` (seed-admin login, user creation per role).
