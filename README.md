# BusRide

Plataforma de rutas y abordaje de autobuses (República Dominicana): pasajeros buscan rutas por geolocalización, reservan con QR, abordan, y el sistema liquida automáticamente las comisiones de plataforma/asociación/conductor. Incluye tracking del bus en tiempo real.

## Stack

- **Backend**: NestJS 10 (TypeScript), API REST bajo `/api/v1`, Swagger en `/api/docs`
- **Base de datos**: SQL Server 2022 — el núcleo transaccional y geoespacial vive en **stored procedures** y columnas `geography` (no en TypeScript)
- **Tiempo real**: Socket.IO (namespace `/tracking`)

El proyecto vive en `busride-app/`: `backend/` (API), `database/init/` (schema + SPs + seeds), `docker-compose.yml`.

## Arranque con Docker

```bash
cd busride-app
docker compose up
```

Servicios: `sqlserver` (SQL Server 2022), `sqlserver-init` y `backend` (puerto 3000).

> **`sqlserver-init`**: la imagen oficial de mssql NO ejecuta los scripts de `/docker-entrypoint-initdb.d`. Este servicio one-shot espera a que `sqlserver` esté healthy y ejecuta `database/init.sh` (01 crear BD → 02 schema → 03 stored procedures → 04 seed admin), de forma idempotente. El `backend` no arranca hasta que termina con éxito.

## Arranque sin Docker (BD en contenedor, app local)

```bash
cd busride-app
docker compose up -d sqlserver sqlserver-init   # BD inicializada
cd backend
cp .env.example .env                            # ajustar PORT/credenciales si hace falta
npm install
npm run start:dev                               # http://localhost:<PORT>/api/v1
```

Init manual de la BD (alternativa): `docker exec -i busride_sqlserver bash < database/init.sh`.

**Admin inicial** (seed `04_seed_admin.sql`): `admin@busride.do` / `Admin123!cambiar` — **cambiar en producción**. El registro público solo crea pasajeros; los demás roles los crea un admin vía `POST /auth/usuarios`.

## Comandos (desde `busride-app/backend/`)

| Comando | Qué hace |
|---|---|
| `npm run build` / `npm run start:prod` | Compilar a `dist/` y ejecutar (`node dist/src/main.js`) |
| `npm run lint` | ESLint con `--fix` |
| `npx jest` | Tests unitarios (120) |
| `npx jest --config test/jest-e2e.json --runInBand` | Tests e2e (47) — requiere el contenedor `busride_sqlserver` con la BD inicializada |
| `npm run migration:generate -- src/database/migrations/<Nombre>` | Generar migración TypeORM |
| `npm run migration:run` / `migration:revert` | Aplicar / revertir migraciones |

## Endpoints (resumen por módulo)

Salvo los marcados `@Public`, todos exigen `Authorization: Bearer <accessToken>`. Roles: `admin`, `asociacion`, `conductor`, `pasajero`.

| Módulo | Endpoints clave | Rol |
|---|---|---|
| **Auth** | `POST /auth/registrar` (público, solo pasajero) · `POST /auth/login` · `POST /auth/refresh` (públicos) · `POST /auth/logout` · `POST /auth/usuarios` (crear usuario con rol) | público / admin |
| **Usuarios** | `GET/PATCH /usuarios/me`, `PATCH /usuarios/me/password` · `GET /usuarios`, `PATCH /usuarios/:id/estado` | propio / admin |
| **Asociaciones** | `GET /asociaciones`, `GET /asociaciones/:id` · `POST`, `PATCH /:id`, `PATCH /:id/aprobar`, `PATCH /:id/usuario-admin` | autenticado / admin |
| **Conductores** | `POST /conductores` (alta) · `GET /conductores/me` · `GET /conductores/asociacion/:id` · `POST /conductores/:id/calificar` | admin+asociacion / conductor / pasajero |
| **Flota** | `POST/PATCH /flota/buses`, `POST /flota/horarios`, `POST /flota/asignaciones`, `PATCH /flota/asignaciones/:id/desactivar` (admin/asociación) · `GET /flota/asignaciones/mias` (conductor) · `GET /flota/buses/asociacion/:id`, `GET /flota/horarios/ruta/:id` (lectura) | ver detalle |
| **Rutas** | `GET /rutas/buscar` (búsqueda geoespacial) · `GET /rutas/:id`, `/:id/paradas`, `/asociacion/:id` · `POST /rutas` | autenticado / admin+asociacion |
| **Reservas** | `POST /reservas` (genera QR JWT 5 min), `GET /reservas/mias` (pasajero) · `POST /reservas/abordar` (conductor) | pasajero / conductor |
| **Viajes** | `POST /viajes/iniciar`, `POST /viajes/:id/finalizar`, `PATCH /viajes/:id/posicion`, `GET /viajes/mi-activo`, `GET /viajes/:id/parada/:paradaId/pasajeros` | conductor |
| **Wallet** | `GET /wallet/paquetes` · `GET /wallet/mi-saldo`, `POST /wallet/comprar` (idempotente por `referenciaExterna`), `GET /wallet/historial` | pasajero |
| **Liquidaciones** | `GET /liquidaciones/mias`, `/mias/resumen` (conductor) · `PATCH /liquidaciones/:id/pagar` (admin) | conductor / admin |

Documentación interactiva: **Swagger en `http://localhost:<PORT>/api/docs`**.

WebSocket `/tracking` (Socket.IO): el conductor emite `actualizar_posicion`; los pasajeros se suscriben con `suscribir_viaje` y reciben `posicion_bus`.

## Seguridad

- **JWT + refresh rotation**: access token JWT (24 h por defecto) + refresh token opaco (sha256 en BD, 7 días, rotación en cada `/auth/refresh`; `logout` revoca todos).
- **Roles**: guards globales en cadena `ThrottlerHttpGuard` (rate limit 100 req/60 s por IP, configurable con `THROTTLE_LIMIT`/`THROTTLE_TTL_MS`) → `JwtAuthGuard` (todo exige token salvo `@Public`) → `RolesGuard` (`@Roles(...)` por endpoint).
- **Identidad del JWT**: `pasajeroId`/`conductorId` se derivan siempre del token (`/mias`, `/mi-saldo`, `/mi-activo`), nunca de params/body (anti-IDOR).
- **Registro público solo pasajero**: roles privilegiados únicamente vía `POST /auth/usuarios` con token admin (primer admin: seed).
- **QR de abordaje**: el QR es un JWT firmado de 5 minutos (`{ pasajeroId, viajeId, paradaOrigenId, tipo: 'ABORDAJE' }`); el abordaje lo valida y el SP `sp_confirmar_abordaje` asigna asiento, descuenta saldo y emite ticket de forma atómica.
- **WS autenticado**: los mensajes del gateway de tracking pasan por `WsJwtGuard`; solo el conductor del viaje puede emitir posición.
