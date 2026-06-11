# BusRide — Plan de Modificación

> Fecha de análisis: 2026-06-10 · Rama: `main` · Commit base: `f56f899`

## 1. Estado actual del repositorio

### ✅ Hecho

| Área | Detalle |
|---|---|
| Infraestructura | `docker-compose.yml` con SQL Server 2022, Redis 7 y backend NestJS. Healthchecks y volúmenes configurados. |
| Base de datos | Esquema completo en `database/init/02_schema.sql`: 20 tablas, índices, seeds (roles, paquetes de viaje, config de comisiones). |
| Stored procedures | 7 SPs operativos: `sp_buscar_rutas_disponibles`, `sp_crear_reserva`, `sp_confirmar_abordaje`, `sp_liquidar_viaje`, `sp_expirar_reservas`, `sp_pasajeros_en_parada`, `sp_actualizar_calificacion_conductor`. |
| Bootstrap NestJS | `main.ts` con prefijo `api/v1`, ValidationPipe global, CORS, Swagger en `/api/docs`. Throttling global (100 req/60s). |
| Auth | Registro y login con JWT + bcrypt (`JwtStrategy`, `JwtAuthGuard`). |
| Rutas | Búsqueda geoespacial vía SP, creación de rutas con paradas (columnas `geography`), listados. |
| Reservas | Reserva con QR = JWT firmado (TTL 5 min) + imagen base64; confirmación de abordaje vía SP. |
| Viajes | Iniciar/finalizar viaje, actualización GPS, liquidación vía SP. |
| Tracking en tiempo real | `TrackingGateway` Socket.IO (namespace `/tracking`), rooms por viaje. |
| Wallet | Saldo, compra de paquetes (transaccional), historial. |
| Liquidaciones | Historial, resumen por período, marcar pagada. |
| Entidades TypeORM | 10 de 20 tablas mapeadas (rol, usuario, asociacion, conductor, pasajero, wallet, ruta, parada, viaje, reserva). |

### ❌ Falta / Deficiencias detectadas (con estado al cierre, 2026-06-10)

| # | Problema | Severidad | Detalle | Estado final |
|---|---|---|---|---|
| F1 | Módulos incompletos | Alta | `usuarios`, `asociaciones`, `conductores` solo tienen entidades — sin controller/service/module. | ✅ Resuelto (Ola 3: T-05/T-06/T-07; + `flota` T-08) |
| F2 | DTOs no validan | **Crítica** | Los DTOs son `interface` (reservas, rutas) o tipos inline en `@Body()`. El `ValidationPipe` global no tiene metadata que validar → ninguna entrada se valida realmente. | ✅ Resuelto (DTOs clase con class-validator en todos los módulos; rutas en T-12) |
| F3 | Sin autorización por roles | **Crítica** | No existe `RolesGuard` ni decorador `@Roles`. Cualquier usuario autenticado puede llamar endpoints admin (`liquidaciones/:id/pagar`). | ✅ Resuelto (guards globales Throttler→Jwt→Roles + `@Public`; registro público solo pasajero — B1, Ola 6) |
| F4 | IDOR | **Crítica** | `pasajeroId`/`conductorId` llegan por parámetro de URL/body en vez de derivarse del JWT — un pasajero puede consultar el wallet o reservas de otro. | ✅ Resuelto (rutas `/mias`, `/mi-saldo`, `/mi-activo`; `iniciarViaje` valida dueño de la asignación — B2, Ola 6) |
| F5 | Entidades faltantes | Media | 10 tablas sin entidad: `buses`, `abordajes`, `liquidaciones`, `transacciones`, `paquetes_viaje`, `horarios`, `asignaciones_bus_ruta`, `config_comisiones`, `calificaciones`, `tokens_refresco`. Se accede solo por SQL crudo. | ✅ Resuelto (T-03/T-04) |
| F6 | Refresh tokens | Media | La tabla `tokens_refresco` existe pero no hay endpoint refresh/logout ni rotación. | ✅ Resuelto (T-04: refresh opaco con rotación, logout revoca todos) |
| F7 | Reservas nunca expiran | Alta | `sp_expirar_reservas` existe pero nadie lo invoca — falta cron (`@nestjs/schedule` no instalado). | ✅ Resuelto (ReservasCronService cada minuto, T-09/T-12) |
| F8 | Registro incompleto | Alta | Al registrar un pasajero no se crean sus filas en `pasajeros` ni `wallet_pasajeros` → el flujo reserva/wallet falla para usuarios nuevos. | ✅ Resuelto (registro transaccional, T-04) |
| F9 | WebSocket sin auth | Alta | `TrackingGateway` acepta cualquier conexión (`cors: *`); cualquiera puede emitir `actualizar_posicion` y falsear el GPS de un bus. | ✅ Resuelto en mensajes (`WsJwtGuard` + verificación de conductor del viaje, T-11); `handleConnection` sigue abierto (mínimo acordado) |
| F10 | Wallet sin idempotencia | Media | `comprarPaquete` no valida que exista la wallet ni deduplica por `referencia_externa` (doble cobro posible). | ✅ Resuelto (T-10 + índice único filtrado en BD, T-12) |
| F11 | Sin tests | Alta | 0 archivos `.spec.ts`; no hay `jest.config`; `npm test` no funciona. | ✅ Resuelto (Ola 5/6: 120 unit + 47 e2e, 0 skip) |
| F12 | Sin config ESLint | Media | El script `lint` referencia ESLint pero no hay config ni dependencias instaladas. | ✅ Resuelto (T-01) |
| F13 | Redis sin usar | Baja | Levantado en docker-compose pero ningún código lo usa (candidato: posiciones GPS, rate limit, sesiones WS). | ⬜ Pendiente (fuera de alcance; fase futura) |
| F14 | Sin migraciones | Baja | Carpeta `src/database/migrations` no existe; el esquema solo vive en los `.sql` de init. | ⬜ Pendiente (fuera de alcance; el schema vive en `database/init` + `init.sh` idempotente) |
| F15 | Sin README | Baja | No hay documentación de arranque para desarrolladores. | ✅ Resuelto (README.md en la raíz, T-16) |
| F16 | Acceso interno frágil | Baja | `viajes.controller.ts` usa `this.viajesService['dataSource']` (acceso a privado por índice). | ✅ Resuelto (T-11) |
| F17 | CRUD de operación faltante | Media | No hay endpoints para gestionar buses, horarios ni asignaciones bus-ruta (necesarios para que `iniciarViaje` tenga datos). | ✅ Resuelto (módulo flota, T-08; endurecido en B6, Ola 6) |
| F18 | Calificaciones | Baja | Tabla y SP existen, pero no hay endpoint para calificar un viaje. | ✅ Resuelto (`POST /conductores/:id/calificar`, T-07) |

## 2. Objetivo de la modificación

Llevar el backend de "esqueleto funcional" a "API completa y segura":

1. **Seguridad primero**: validación real de DTOs, roles, identidad derivada del JWT, WS autenticado (resuelve F2, F3, F4, F9).
2. **Completar el dominio**: módulos y entidades faltantes, CRUD de operación, registro completo de pasajeros (F1, F5, F8, F17, F18).
3. **Robustez**: cron de expiración, refresh tokens, idempotencia wallet (F6, F7, F10).
4. **Calidad**: tooling de lint/test, suite de pruebas, documentación (F11, F12, F15).

Fuera de alcance por ahora: frontend (Angular según `CORS_ORIGIN`), uso de Redis (F13), migraciones formales (F14) — quedan como fases futuras.

## 3. Estrategia de ejecución con subagentes

Las tareas están organizadas en **olas** (ver `TAREAS.md`). Reglas anti-colisión:

- **Propiedad exclusiva de archivos**: cada tarea declara los archivos/carpetas que crea o modifica. Dos tareas de la misma ola nunca comparten archivos.
- **Archivos compartidos van en tareas integradoras secuenciales**: `app.module.ts`, `main.ts` y `package.json` solo los toca una tarea por ola (o la tarea de integración al final de la ola).
- **Dependencias npm centralizadas**: todas las instalaciones de paquetes se hacen en la tarea T-01 (Ola 1), nunca en tareas paralelas.
- **Las olas son barreras**: ninguna tarea de la ola N+1 arranca hasta que toda la ola N esté integrada y compile (`npm run build`).
- **Criterio de cierre por ola**: `npm run build` y `npm run lint` en verde; desde la Ola 4, también `npm test`.

| Ola | Contenido | Paralelismo |
|---|---|---|
| 1 | Tooling, `src/common` (guards/decoradores), entidades faltantes | 3 tareas en paralelo |
| 2 | Integración de la Ola 1 + hardening de auth (secuencial) | 1 tarea |
| 3 | Módulos nuevos (usuarios, asociaciones, conductores, flota) + hardening de módulos existentes | hasta 7 tareas en paralelo |
| 4 | Integración (AppModule, main.ts) + cron de expiración | 1 tarea |
| 5 | Tests unitarios y e2e | 3 tareas en paralelo |
| 6 | Documentación final y verificación end-to-end | 1 tarea |

## 4. Estado final (2026-06-10)

Las 16 tareas de las 6 olas están completadas (ver `TAREAS.md`). Los bugs B1-B6 de la Ola 5 quedaron corregidos en T-16 (B6 parcial, con decisión documentada en el controller de flota). Verificación final en verde: `npm run build`, `npm run lint`, **120 tests unitarios (0 skip)** y **47 tests e2e** contra el contenedor `busride_sqlserver`, más bootstrap de la app comprobado (`node dist/src/main.js`, PORT=3002).

**Queda fuera de alcance** (fases futuras):

- **Frontend** (Angular según `CORS_ORIGIN`): no existe aún.
- **Redis** (F13): levantado en docker-compose pero sin uso en código (candidatos: caché de posiciones GPS, storage del throttler, sesiones WS).
- **Migraciones TypeORM formales** (F14): el schema sigue siendo propiedad de `database/init/*.sql` + `init.sh` idempotente.
- Menores: forzar el cambio de password del admin seed en el primer login; `handleConnection` del gateway WS sigue abierto (los mensajes sí están autenticados); verificación de email de usuarios (el flag `verificado` no se usa).
