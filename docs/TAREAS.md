# BusRide — Tareas secuenciadas para subagentes

> Convención: cada tarea lista **Depende de**, **Archivos en propiedad** (solo esa tarea puede tocarlos durante su ola) y **Criterio de aceptación**.
> Las olas son barreras: no arranca la ola N+1 hasta cerrar la N con `npm run build` (+ `lint`, y `test` desde la Ola 4) en verde.
> Rutas relativas a `busride-app/backend/` salvo indicación contraria.

## Grafo de dependencias

```
Ola 1:  T-01 (tooling+deps)   T-02 (common)   T-03 (entidades)     [paralelo]
              └────────┬───────────┴───────────────┘
Ola 2:              T-04 (integración base + auth hardening)        [secuencial]
              ┌───────┬───────┬───────┼───────┬───────┬───────┐
Ola 3:      T-05    T-06    T-07    T-08    T-09    T-10    T-11    [paralelo]
          usuarios asocia. conduct. flota  reservas wallet  viajes/liq
              └───────┴───────┴───────┼───────┴───────┴───────┘
Ola 4:              T-12 (integración AppModule + cron)             [secuencial]
              ┌───────────────┬───────┴───────────────┐
Ola 5:      T-13 unit       T-14 unit                T-15 e2e       [paralelo]
              └───────────────┴───────┬───────────────┘
Ola 6:              T-16 (docs + verificación final)                [secuencial]
```

---

## OLA 1 — Fundaciones (3 subagentes en paralelo)

### T-01 · Tooling y dependencias ✦ ÚNICA tarea autorizada a tocar `package.json`
- **Depende de**: nada.
- **Archivos en propiedad**: `package.json`, `package-lock.json`, `eslint.config.mjs` (nuevo), `jest.config.js` (nuevo), `test/jest-e2e.json` (nuevo), `.prettierrc` (nuevo).
- **Trabajo**:
  1. Instalar devDeps: `eslint`, `@typescript-eslint/*`, `prettier`, `jest`, `ts-jest`, `@types/jest`, `supertest`, `@types/supertest`.
  2. Instalar deps de runtime que necesitarán olas posteriores: `@nestjs/schedule`, `@nestjs/mapped-types`.
  3. Crear config de ESLint (flat config) y Jest (unit + e2e) coherente con NestJS 10.
- **Aceptación**: `npm run lint` y `npx jest --passWithNoTests` corren sin error; `npm run build` sigue en verde.

### T-02 · Infraestructura común (`src/common`)
- **Depende de**: nada (no requiere los paquetes de T-01).
- **Archivos en propiedad**: `src/common/**` (todo nuevo).
- **Trabajo**:
  1. `decorators/roles.decorator.ts` — `@Roles('ADMIN', 'CONDUCTOR', ...)` con `SetMetadata`.
  2. `decorators/current-user.decorator.ts` — extrae `{ userId, email, rol }` del request.
  3. `guards/roles.guard.ts` — lee metadata de roles vía `Reflector` y compara con `request.user.rol`.
  4. `guards/ws-jwt.guard.ts` — valida JWT del handshake de Socket.IO (token en `handshake.auth.token`).
  5. `filters/` o helpers compartidos si hacen falta (mínimo necesario).
- **Restricción**: NO registrar nada en `app.module.ts` (lo hace T-04). NO modificar módulos existentes.
- **Aceptación**: `npm run build` en verde; nada fuera de `src/common/` modificado.

### T-03 · Entidades faltantes
- **Depende de**: nada.
- **Archivos en propiedad**: SOLO archivos nuevos `*.entity.ts`:
  - `src/modules/buses/entities/bus.entity.ts`, `horario.entity.ts`, `asignacion-bus-ruta.entity.ts`
  - `src/modules/reservas/entities/abordaje.entity.ts`
  - `src/modules/liquidaciones/entities/liquidacion.entity.ts`, `config-comision.entity.ts`
  - `src/modules/wallet/entities/transaccion.entity.ts`, `paquete-viaje.entity.ts`
  - `src/modules/conductores/entities/calificacion.entity.ts`
  - `src/modules/auth/entities/token-refresco.entity.ts`
- **Trabajo**: mapear las 10 tablas restantes de `database/init/02_schema.sql` siguiendo el patrón existente (snake_case → camelCase con `@Column({ name })`; columnas `geography` NO se mapean — solo floats lat/lng cuando existan).
- **Restricción**: NO tocar entidades existentes ni ningún `.module.ts`/`app.module.ts` (registro lo hace T-04).
- **Aceptación**: `npm run build` en verde; cada entidad coincide columna a columna con `02_schema.sql`.

---

## OLA 2 — Integración base + Auth (1 subagente, secuencial)

### T-04 · Integración Ola 1 + hardening de Auth
- **Depende de**: T-01, T-02, T-03.
- **Archivos en propiedad**: `src/app.module.ts`, `src/main.ts`, `src/modules/auth/**`, `src/modules/usuarios/entities/usuario.entity.ts` (solo si necesita relación con token-refresco).
- **Trabajo**:
  1. Registrar las 10 entidades nuevas en `AppModule.forFeature` y verificar arranque.
  2. Auth — DTOs clase con `class-validator` (`RegistrarDto`, `LoginDto`, `RefreshDto`) en `src/modules/auth/dto/`.
  3. Refresh tokens: emitir par access+refresh en login, persistir hash en `tokens_refresco`, endpoints `POST /auth/refresh` y `POST /auth/logout`, rotación al refrescar.
  4. Al registrar con rol PASAJERO: crear fila en `pasajeros` y `wallet_pasajeros` en la misma transacción (resuelve F8).
  5. Registrar `RolesGuard` como guard global (junto a JWT donde aplique) o dejarlo listo para uso por-controlador — decidir y documentar en el código.
  6. Corregir hallazgo de T-03: `asociacion.entity.ts` omite la columna `aprobado_por` que sí existe en `02_schema.sql` — añadirla.
- **Notas de la Ola 1**: enum `RolNombre` en `src/common` con valores en minúscula (`admin`, `asociacion`, `conductor`, `pasajero`) tal como están en la BD. Enums nuevos disponibles: `TipoPago`, `EstadoLiquidacion`, `TipoTransaccion`, `EstadoTransaccion`. `EstadoTransaccion` solo tiene `PENDIENTE | COMPLETADA`; extender si se añaden fallos/reembolsos.
- **Aceptación**: `npm run build` + `lint` en verde; flujo registro→login→refresh→logout probado manualmente contra la BD de docker (documentar comandos curl usados en la descripción del commit o en `docs/`).

---

> **Notas de la Ola 2 (leer antes de la Ola 3):**
> - Auth ya emite `{ accessToken, refreshToken, usuario }`; refresh opaco (sha256 en `tokens_refresco`, rotación, logout revoca todos). DTOs de auth con class-validator en `src/modules/auth/dto/` — usar como referencia de estilo.
> - `RolesGuard` ya es global (APP_GUARD). ⚠️ Hasta T-12, un endpoint que declare `@Roles` responderá **403 en runtime** aunque el JWT sea válido (APP_GUARD corre antes que `@UseGuards`, request.user aún vacío). Es deliberado (fail-closed): la Ola 3 solo exige COMPILAR, no probar en runtime los endpoints con @Roles. T-12 lo resuelve con JwtAuthGuard global + decorador `@Public`.
> - Fixes ya aplicados en el cierre de ola: healthcheck del docker-compose (mssql-tools18 + `-C`) y `DB_PORT` con parseInt en `database.config.ts`.
> - INF-1 pendiente para T-12/T-16: la imagen mssql NO ejecuta `database/init/` automáticamente — hay que ejecutar 01/02/03 con sqlcmd (`-I`) en contenedores nuevos. El schema ya está corregido (BOUNDING_BOX inválido eliminado).
> - El contenedor `busride_sqlserver` queda corriendo con la BD poblada (20 tablas, 7 SPs). En el entorno local los puertos 3000/3001 están ocupados por otro proyecto: usar `PORT=3002` (ya está en `backend/.env`).

## OLA 3 — Dominio (hasta 7 subagentes en paralelo)

> Todas dependen de T-04. Cada tarea posee EXCLUSIVAMENTE su carpeta de módulo. Prohibido tocar `app.module.ts`, `main.ts`, `package.json` o carpetas ajenas — el registro en `AppModule` lo hace T-12.
> Patrón común a todas: DTOs como clases con `class-validator` en `dto/`; identidad (`pasajeroId`/`conductorId`/`usuarioId`) derivada de `@CurrentUser()` y NUNCA de params/body (resuelve F4); `@Roles()` + `RolesGuard` en endpoints sensibles; Swagger (`@ApiTags`, `@ApiOperation`).

### T-05 · Módulo Usuarios
- **Archivos en propiedad**: `src/modules/usuarios/**` (excepto entidades ya tocadas en Ola 2 — solo lectura).
- **Trabajo**: `usuarios.module/controller/service`: perfil propio (`GET/PATCH /usuarios/me`), cambio de contraseña, listado/activación-desactivación de usuarios (solo ADMIN).
- **Aceptación**: build en verde con el módulo compilando aislado (aún sin registrar en AppModule).

### T-06 · Módulo Asociaciones
- **Archivos en propiedad**: `src/modules/asociaciones/**`.
- **Trabajo**: CRUD de asociaciones (crear/editar solo ADMIN), listado público de asociaciones activas, vincular usuario administrador de asociación.
- **Aceptación**: ídem T-05.

### T-07 · Módulo Conductores
- **Archivos en propiedad**: `src/modules/conductores/**`.
- **Trabajo**: alta de conductor (ADMIN o ASOCIACION), perfil propio del conductor, listado por asociación, endpoint de calificaciones: `POST /conductores/:id/calificar` (rol PASAJERO, valida que el pasajero abordó un viaje de ese conductor) invocando `sp_actualizar_calificacion_conductor`.
- **Aceptación**: ídem T-05.

### T-08 · Flota: Buses, Horarios y Asignaciones
- **Archivos en propiedad**: `src/modules/flota/**` (módulo NUEVO — no tocar `src/modules/buses/` que pertenece a T-11).
- **Trabajo**: CRUD de buses (rol ASOCIACION/ADMIN), horarios por ruta, asignaciones bus-ruta-conductor (activar/desactivar). Esto alimenta `iniciarViaje` (resuelve F17).
- **Aceptación**: ídem T-05.

### T-09 · Hardening Reservas
- **Archivos en propiedad**: `src/modules/reservas/**`.
- **Trabajo**:
  1. DTOs clase (`CrearReservaDto`, `ConfirmarAbordajeDto`) con validaciones (`@IsUUID`, `@IsLatitude`, etc.).
  2. `pasajeroId` desde `@CurrentUser()` (mapear userId→pasajero); `conductorId` ídem en abordaje. `GET /reservas/mias` reemplaza a `GET /reservas/pasajero/:pasajeroId`.
  3. `@Roles('PASAJERO')` en crear, `@Roles('CONDUCTOR')` en abordar.
  4. Crear `ReservasCronService` con `@Cron` cada minuto que ejecute `sp_expirar_reservas` (resuelve F7) — `@nestjs/schedule` ya está instalado (T-01); `ScheduleModule.forRoot()` lo registra T-12.
- **Aceptación**: ídem T-05.

### T-10 · Hardening Wallet
- **Archivos en propiedad**: `src/modules/wallet/**`.
- **Trabajo**:
  1. DTOs clase; rutas con identidad del JWT (`GET /wallet/mi-saldo`, `POST /wallet/comprar`, `GET /wallet/historial`).
  2. Idempotencia por `referencia_externa`: si ya existe transacción COMPLETADA con esa referencia, devolver la existente sin volver a acreditar (resuelve F10).
  3. Validar existencia de wallet antes de acreditar; crear si falta.
- **Aceptación**: ídem T-05.

### T-11 · Hardening Viajes + Tracking + Liquidaciones
- **Archivos en propiedad**: `src/modules/buses/**` (excepto `entities/` nuevos de T-03 — solo lectura), `src/modules/liquidaciones/**` (excepto entidades).
- **Trabajo**:
  1. DTOs clase en viajes; `conductorId` desde JWT; `@Roles('CONDUCTOR')` en iniciar/finalizar.
  2. Eliminar el hack `this.viajesService['dataSource']` (F16) — mover la query al service.
  3. `TrackingGateway`: aplicar `WsJwtGuard` (de `src/common`); solo el conductor del viaje puede emitir `actualizar_posicion` (verificar viaje activo del conductor).
  4. Liquidaciones: `@Roles('ADMIN')` en `marcarPagada`; conductor solo consulta las suyas (desde JWT).
- **Aceptación**: ídem T-05.

---

> **Notas de la Ola 3 (cerrada — build/lint/jest en verde):**
> - Módulos nuevos pendientes de registrar en AppModule (T-12): `UsuariosModule`, `AsociacionesModule`, `ConductoresModule`, `FlotaModule` + `ScheduleModule.forRoot()` (el cron de reservas ya existe como provider en ReservasModule).
> - Hallazgos de BD de T-10 (para T-12 o T-16, quien toque `database/`): (a) falta índice UNIQUE filtrado para idempotencia: `CREATE UNIQUE INDEX UQ_transacciones_ref_externa ON transacciones(pasajero_id, referencia_externa) WHERE referencia_externa IS NOT NULL AND estado = 'COMPLETADA'`; (b) `transacciones.tipo/estado` sin CHECK constraints contra los valores de los enums.
> - El gateway WS quedó con guard JWT en los mensajes; `handleConnection` sigue abierto (mínimo acordado). El payload JWT crudo queda en `client.data.user` (campo `sub` = usuario id).
> - Rutas que CAMBIARON (breaking, actualizar cualquier cliente/smoke-test): `GET /reservas/pasajero/:id` → `GET /reservas/mias` · `GET /wallet/:id` → `GET /wallet/mi-saldo` · `POST /wallet/:id/comprar` → `POST /wallet/comprar` · `GET /wallet/:id/historial` → `GET /wallet/historial` · `GET /viajes/conductor/:id/activo` → `GET /viajes/mi-activo` · `GET /liquidaciones/conductor/:id` → `GET /liquidaciones/mias` (+ `/mias/resumen`). El typo `referenciaExternal` ahora es `referenciaExterna`.

## OLA 4 — Integración (1 subagente, secuencial)

### T-12 · Integración de dominio
- **Depende de**: T-05…T-11 completas.
- **Archivos en propiedad**: `src/app.module.ts`, `src/main.ts`, y permiso de retoque mínimo transversal para resolver conflictos de compilación entre módulos.
- **Trabajo**:
  1. Registrar en `AppModule`: `UsuariosModule`, `AsociacionesModule`, `ConductoresModule`, `FlotaModule`, `ScheduleModule.forRoot()`.
  2. Hacer global el `JwtAuthGuard` (APP_GUARD, antes de `RolesGuard`) + crear decorador `@Public()` en `src/common` y aplicarlo a login/registrar/refresh — requisito para que `@Roles` funcione en runtime (ver notas Ola 2).
  3. Verificar que no haya providers/JwtModule duplicados (considerar `JwtModule` global único).
  4. Resolver INF-1: automatizar la ejecución de `database/init/` (script o servicio init en docker-compose), o documentarla como paso manual.
  5. Levantar `docker compose up` y smoke-test del flujo completo: registro → login → crear ruta → asignar bus → iniciar viaje → reservar → abordar → finalizar → liquidación.
- **Aceptación**: build + lint en verde; smoke-test documentado (lista de requests y respuestas) en `docs/VERIFICACION.md`.

---

> **Notas de la Ola 4 (leer antes de la Ola 5):**
> - **Pre-paso Ola 5 (cierre del hallazgo de T-12)**: módulo `rutas` endurecido — `dto/buscar-rutas.dto.ts` (query con @Type(Number)) y `dto/crear-ruta.dto.ts` (paradas anidadas con @ValidateNested, mínimo 2); `POST /rutas` ahora @Roles(admin, asociacion) con asociación derivada del JWT (rol asociacion) o `asociacionId` en el DTO (admin, validada); `ParseUUIDPipe` en todos los params UUID. La interfaz `BuscarRutasDto` del service se eliminó (ahora es clase en dto/). `crearRutaComoUsuario(user, dto)` es el punto de entrada del controller.
> - **Guards globales (orden)**: `JwtAuthGuard` → `RolesGuard`, ambos `APP_GUARD` en `AppModule`. `@Public()` (en `src/common`) exime de JWT a login/registrar/refresh. El `JwtAuthGuard` devuelve `true` en contextos no-HTTP (no rompe gateways WS). Para tests e2e: TODA ruta salvo las `@Public` exige `Authorization: Bearer`.
> - **JwtModule es global** (registrado una sola vez en `AuthModule` con `{ global: true }`); `ReservasModule`/`ViajesModule` ya NO registran el suyo. En tests unitarios de esos services hay que proveer un mock de `JwtService` directamente.
> - **`ScheduleModule.forRoot()` activo**: `ReservasCronService` ejecuta `sp_expirar_reservas` cada minuto. En tests e2e conviene cerrar la app con `app.close()` para que el scheduler no deje el proceso vivo.
> - **Bugs corregidos en T-12** (entidad↔schema; detalles en VERIFICACION.md): `Ruta.polylineWkt`, `Parada.lat/lng` y `Reserva.latPasajero/lngPasajero` ya NO son columnas (propiedades de transporte; los datos geo viven en columnas `geography` vía SQL crudo); `crearRuta` excluye `paradas`/`polylineWkt` del save; `FlotaService.crearBus` filtra asociaciones por `estado='ACTIVA'` (no existe columna `activa`); `viajes` ganó columnas reales `pos_lat`/`pos_lng` (schema + BD viva).
> - **BD para tests**: contenedor `busride_sqlserver` corriendo con datos de los smoke `t12a..t12d`. Desde cero: `docker compose up -d sqlserver sqlserver-init` (nuevo servicio one-shot que ejecuta `database/init.sh`: 01→02→03, idempotente) o manual `docker exec -i busride_sqlserver bash < database/init.sh`. Índice de idempotencia `UQ_transacciones_ref_externa` ya aplicado (schema y BD viva).
> - **Entorno local**: app en `PORT=3002` (3000/3001 ocupados); `DB_PORT` sigue comentado en `.env` (INF-4 pendiente: `database.config.ts` no hace parseInt).
> - **Hallazgo abierto** (Ola 5/6): `POST /rutas` usa `@Body() body: any` sin DTO ni `@Roles` — cualquier autenticado puede crear rutas; el módulo rutas nunca fue endurecido. Los CHECK constraints de `transacciones.tipo/estado` siguen pendientes (opcionales).

## OLA 5 — Pruebas (3 subagentes en paralelo)

> Dependen de T-12. Solo crean archivos `*.spec.ts` / `test/**` — cero modificaciones a `src/` salvo bugs encontrados, que se reportan (no se arreglan) para evitar colisiones.

### T-13 · Tests unitarios: auth, usuarios, wallet
- **Archivos en propiedad**: `src/modules/{auth,usuarios,wallet}/**/*.spec.ts`.
- **Trabajo**: specs de services con repos/datasource mockeados. Casos clave: login inválido, refresh rotación, registro crea pasajero+wallet, idempotencia de compra.

### T-14 · Tests unitarios: reservas, viajes, rutas, liquidaciones
- **Archivos en propiedad**: `src/modules/{reservas,buses,rutas,liquidaciones,flota,conductores,asociaciones}/**/*.spec.ts`.
- **Trabajo**: specs de services. Casos clave: QR expirado rechazado, conductor con viaje en curso no puede iniciar otro, SP con `exito=false` lanza `BadRequestException`.

### T-15 · Tests e2e
- **Archivos en propiedad**: `test/**`.
- **Trabajo**: e2e con supertest contra la BD de docker: flujo feliz completo + casos 401/403 (sin token, rol incorrecto, IDOR bloqueado).

- **Aceptación de la ola**: `npm test` en verde; bugs hallados listados en `docs/VERIFICACION.md`.

---

> **Notas de la Ola 5 (bugs consolidados para T-16, por prioridad):**
> - **B1 (crítico, seguridad)** — Escalada de privilegios en `POST /auth/registrar`: es `@Public` y acepta cualquier `rolId` → cualquiera se registra como admin. Corregir (p. ej. registro público solo pasajero; roles privilegiados solo con token admin). ⚠️ Los e2e de `test/` registran los 4 roles por el endpoint público — habrá que adaptar helpers/tests al nuevo diseño.
> - **B2 (crítico, seguridad)** — IDOR en `ViajesService.iniciarViaje` (viajes.service.ts:54-59): la query de asignación no filtra por `conductor_id`; un conductor puede iniciar el viaje de otro. Test listo en `it.skip` (viajes.service.spec.ts) — quitar el skip al corregir.
> - **B3 (seguridad)** — `ThrottlerModule` registrado pero `ThrottlerGuard` nunca vinculado: el rate limit no se aplica. Añadir APP_GUARD.
> - **B4** — RNC duplicado en asociaciones lanza 400; debe ser `ConflictException` 409 (consistencia). Test en `it.skip` (asociaciones.service.spec.ts) — quitar el skip.
> - **B5 (robustez)** — `resultado[0]` sin comprobar recordset vacío en `ReservasService.crearReserva`/`confirmarAbordaje` y `ViajesService.finalizarViaje` → 500 en vez de error controlado.
> - **B6 (valorar)** — `GET /flota/asignaciones/conductor/:id` y `GET /flota/buses/asociacion/:id` aceptan IDs ajenos (lectura sin @Roles); inconsistente con F4 — corregir o documentar decisión.
> - Pendientes de BD: CHECK constraints de `transacciones.tipo/estado`.
> - Suite actual: 113 unit (2 skip ligados a B2/B4) + 42 e2e, todo lo demás en verde. E2e requiere contenedor `busride_sqlserver` corriendo; `testTimeout` 60s en jest-e2e.json; los e2e cierran la app con `app.close()`.

## OLA 6 — Cierre (1 subagente)

### T-16 · Documentación y verificación final
- **Depende de**: T-13…T-15.
- **Archivos en propiedad**: `README.md` (raíz del repo), `docs/**`, `CLAUDE.md` (actualizar si la arquitectura cambió), `backend/.env.example` (si se añadieron variables).
- **Trabajo**:
  1. README con arranque local (docker y sin docker), variables de entorno, mapa de endpoints.
  2. Corregir los bugs reportados por la Ola 5 (o crear tareas de seguimiento si son grandes).
  3. Actualizar este archivo marcando tareas completadas y `PLAN.md` con el nuevo estado.
- **Aceptación**: `npm run build && npm run lint && npm test` en verde; smoke-test final repetido.

---

## Estado de tareas

| Tarea | Ola | Estado |
|---|---|---|
| T-01 Tooling y dependencias | 1 | ✅ Completada (2026-06-10) |
| T-02 Infraestructura común | 1 | ✅ Completada (2026-06-10) |
| T-03 Entidades faltantes | 1 | ✅ Completada (2026-06-10) |
| T-04 Integración base + Auth | 2 | ✅ Completada (2026-06-10) |
| T-05 Módulo Usuarios | 3 | ✅ Completada (2026-06-10) |
| T-06 Módulo Asociaciones | 3 | ✅ Completada (2026-06-10) |
| T-07 Módulo Conductores | 3 | ✅ Completada (2026-06-10) |
| T-08 Flota (buses/horarios/asignaciones) | 3 | ✅ Completada (2026-06-10) |
| T-09 Hardening Reservas + cron | 3 | ✅ Completada (2026-06-10) |
| T-10 Hardening Wallet | 3 | ✅ Completada (2026-06-10) |
| T-11 Hardening Viajes/Tracking/Liquidaciones | 3 | ✅ Completada (2026-06-10) |
| T-12 Integración de dominio | 4 | ✅ Completada (2026-06-10) |
| T-13 Tests unitarios (auth/usuarios/wallet) | 5 | ✅ Completada (2026-06-10) — 39 tests |
| T-14 Tests unitarios (dominio) | 5 | ✅ Completada (2026-06-10) — 76 tests (2 skip por bugs) |
| T-15 Tests e2e | 5 | ✅ Completada (2026-06-10) — 42 tests |
| T-16 Docs y verificación final | 6 | ✅ Completada (2026-06-10) — bugs B1-B6 corregidos; 120 unit (0 skip) + 47 e2e |

---

> **Nota de cierre de la Ola 6 (T-16, 2026-06-10):**
> - **B1 ✅** — `POST /auth/registrar` ya solo crea PASAJEROS: el `RegistrarDto` no acepta `rolId` (enviarlo → 400 por `forbidNonWhitelisted`); el service resuelve el rol pasajero por nombre. Nuevo `POST /auth/usuarios` con `@Roles(admin)` (DTO `CrearUsuarioDto`) para crear cualquier rol. El PRIMER admin viene del seed `database/init/04_seed_admin.sql` (`admin@busride.do` / `Admin123!cambiar`, **cambiar en producción**; idempotente, integrado en `init.sh` y aplicado a la BD viva). E2e adaptados: helpers nuevos `loguearAdminSeed`/`crearUsuarioYLoguear`.
> - **B2 ✅** — `iniciarViaje` ahora selecciona `a.conductor_id` de la asignación y lo compara con el conductor autenticado → 403 `ForbiddenException` si es ajena (se eligió comparación en TS en vez de `AND a.conductor_id = @1` para distinguir 403 de 400 "no encontrada"). `it.skip` eliminado + e2e nuevo (paso 5b de flujo-completo).
> - **B3 ✅** — `ThrottlerHttpGuard` (nuevo, en `src/common/guards/`; extiende `ThrottlerGuard` devolviendo `true` en contextos no-HTTP, igual que el JwtAuthGuard global) registrado como primer `APP_GUARD` (antes de JwtAuthGuard: limita también login/registrar). Límites por env `THROTTLE_LIMIT`/`THROTTLE_TTL_MS` (defaults 100/60000); los e2e ponen `THROTTLE_LIMIT=10000` en `e2e.helpers.ts` antes de compilar el módulo.
> - **B4 ✅** — RNC duplicado en `asociaciones.service.ts` (crear y actualizar) → `ConflictException` 409; `it.skip` eliminado.
> - **B5 ✅** — `crearReserva`/`confirmarAbordaje`/`finalizarViaje` lanzan `BadRequestException('El procedimiento ... no devolvió resultado')` si el SP devuelve recordset vacío (+1 test unitario por caso).
> - **B6 ✅ (parcial, decidido)** — nuevo `GET /flota/asignaciones/mias` (conductor, identidad del JWT); `GET /flota/asignaciones/conductor/:id` restringido a `@Roles(admin, asociacion)`. `GET /flota/buses/asociacion/:id` queda abierto a cualquier autenticado por decisión documentada en el controller (lectura no sensible; el IDOR explotable se cerró en B2).
> - **BD** — CHECK constraints añadidos a `02_schema.sql` y a la BD viva (WITH CHECK, datos legacy limpios): `CK_transacciones_tipo IN ('RECARGA','ABORDAJE','DEVOLUCION')` y `CK_transacciones_estado IN ('PENDIENTE','COMPLETADA')` (valores verificados en código/SPs).
> - **Docs** — `README.md` (raíz) creado; `CLAUDE.md` actualizado (guards globales, init de BD, DTOs clase, tests); `backend/.env.example` con `REFRESH_TOKEN_DIAS`, `THROTTLE_LIMIT`, `THROTTLE_TTL_MS`.
> - **Verificación final**: `npm run build` ✅ · `npm run lint` ✅ · `npx jest` → **120 tests, 0 skip** ✅ · e2e `--runInBand` → **47 tests** ✅ · bootstrap `node dist/src/main.js` (PORT=3002) con login del admin seed y Swagger 200 ✅ (detalle en VERIFICACION.md).
> - **Fuera de alcance** (fases futuras): frontend, uso real de Redis, migraciones TypeORM formales, cambio forzado de la password del admin seed.
