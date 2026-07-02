# Auditoría de preparación para producción — BusRide

**Fecha:** 2026-07-01
**Alcance:** backend (NestJS), frontend (Angular), infraestructura (Docker/BD/despliegue)
**Método:** 3 auditorías paralelas — build/tests/lint ejecutados + revisión de configuración y seguridad
**Veredicto:** ❌ **NO listo para producción.** El código está sano; faltan la capa de despliegue y el endurecimiento operativo.

---

## 1. Resumen ejecutivo

| Área | Código | Despliegue |
|---|---|---|
| Backend | ✅ Build, 134/134 tests unitarios, lint limpio | ❌ Dockerfile de desarrollo, sin migraciones |
| Frontend | ✅ Build prod, tsc y lint limpios | ❌ Sin Dockerfile/nginx, requiere reverse proxy inexistente |
| Infraestructura | — | ❌ Secretos hardcodeados, sin TLS, sin CI/CD, compose solo de desarrollo |

---

## 2. Backend (NestJS)

### ✅ Listo
- `npm run build` compila sin errores.
- **134/134 tests unitarios** en 11 suites pasan (`npx jest`). Nota CI: una caché stale de jest provocó un falso fallo (TS2305 en `usuarios.service.spec.ts`); se resolvió con `npx jest --clearCache`. En CI usar caché limpia.
- `npm run lint` sin errores ni warnings.
- **JWT_SECRET sin fallback inseguro** (`auth.module.ts:28`, `jwt.strategy.ts:12`): si falta la variable, la app no arranca (fail-fast correcto). JwtModule es global (nota: CLAUDE.md dice que ReservasModule registra el suyo — desactualizado).
- Cadena de guards global (Throttler → JwtAuthGuard → RolesGuard, `app.module.ts:102-104`) y `ValidationPipe` estricto (`main.ts:11-15`).
- `.env` NO commiteado (solo `.env.example`); `.env.example` cubre todas las variables que lee el código.
- Sin TODOs/FIXMEs; `synchronize: false` y datasources consistentes entre sí.

### ⚠️ Riesgos
1. **CORS**: `origin: process.env.CORS_ORIGIN || '*'` + `credentials: true` (`main.ts:18`). Si falta la variable en producción queda abierto a todo origen; `'*'` + credentials es una combinación inválida/peligrosa.
2. **Sin `helmet` ni `compression`** — faltan cabeceras de seguridad HTTP.
3. **Conexión a SQL Server sin cifrar**: `encrypt: false, trustServerCertificate: true` fijos (`database.config.ts:13-14`, `data-source.ts:13-14`). Debería ser configurable por env.
4. **Swagger expuesto incondicionalmente** en `/api/docs` (`main.ts:24-31`) — gatear por `NODE_ENV`.
5. **Logging mínimo**: 2 `Logger` + 2 `console.log`; sin logging estructurado, request-logging ni filtro global de excepciones.
6. `data-source.ts:20`: `logging: true` fijo (menor, solo CLI).

### ❌ Bloqueantes
1. **Dockerfile no productivo** (`backend/Dockerfile`): single-stage con devDependencies, corre como root, sin `NODE_ENV=production`, `CMD npm run start:prod` (mala propagación de señales), sin HEALTHCHECK. → Multi-stage, `USER node`, `node dist/src/main.js`.
2. **Sin migraciones**: `src/database/migrations/` no existe; los scripts `migration:*` apuntan a un directorio inexistente. Sin camino de evolución de esquema en producción. → Generar baseline o documentar el proceso.
3. **Sin validación de env al boot**: `DB_PASSWORD` ausente produce error opaco. → `ConfigModule.forRoot({ validationSchema })` (Joi).

---

## 3. Frontend (Angular)

### ✅ Listo
- Build de producción limpio: **495.65 kB raw / 127.15 kB transfer** inicial, dentro de presupuesto; chunks pesados (QR @zxing 485 kB, leaflet 460 kB) son lazy.
- `tsc --noEmit` y `npm run lint` limpios; cero TODO/FIXME; solo 2 `console.*` justificados.
- Entornos bien diseñados: `environment.ts` prod con URLs relativas (`/api/v1`, socket mismo-origen); sin localhost hardcodeado; `proxy.conf.json` solo dev.
- **Auth robusta**: refresh compartido en vuelo (`shareReplay`), rotación persistida, restauración de sesión al boot, interceptor 401 → un refresh → retry → si falla limpia y redirige. Con spec.
- **Guards por rol** correctos en las 3 áreas (pasajero/conductor/panel) con redirección por rol.

### ⚠️ Riesgos
1. **El despliegue requiere reverse proxy mismo-origen** para `/api` y `/socket.io` (con upgrade WS). No existe nginx/Dockerfile del frontend ni mecanismo de URL en runtime.
2. **Tokens en `localStorage`** — exfiltrables por XSS; mitigado por rotación + revocación. Considerar cookie httpOnly para el refresh (cambio de backend). Además `tracking-socket.service.ts:22` duplica la clave `'busride.accessToken'` como literal.
3. Bundle inicial a 4 kB del warning de presupuesto (495.65/500 kB); leaflet es CommonJS (bailout conocido).
4. **E2E Playwright sin corrida verde registrada**: 4 specs (~485 líneas) que requieren backend real en :3002 + BD inicializada; `test-results/` vacía.

### ❌ Bloqueantes
- Ninguno de compilación/calidad. El bloqueante era **~46 archivos + suite e2e sin commitear** (resuelto en esta sesión — ver §6).

---

## 4. Infraestructura

### ✅ Listo
- Healthcheck de SQL Server correcto; init one-shot idempotente (`sqlserver-init`); orquestación `depends_on` bien hecha.
- Volúmenes persistentes (`sqlserver_data`, `redis_data` con AOF); red bridge dedicada.
- Índices espaciales en todas las columnas `geography` + B-tree en FKs/estados; seed admin idempotente con bcrypt cost 12.
- Sin `.env` real en git.

### ⚠️ Riesgos
- Puertos 1433 (SQL) y 6379 (Redis) publicados al host — innecesario, solo el backend los necesita por red interna.
- Sin `restart` policies (salvo init); sin healthcheck de redis/backend.
- **Redis declarado pero sin uso**: cero referencias en `backend/src`, sin cliente en `package.json`, y corre **sin contraseña**. Decidir: cablear (throttler/cache/adapter socket.io) o eliminar.
- Compose monta `./database/init` en `sqlserver` aunque la imagen no lo ejecuta (confuso, inofensivo).
- Sin guía de despliegue a producción (dominios, TLS, secretos, backups).

### ❌ Bloqueantes
1. **Secretos hardcodeados y commiteados**: `SA_PASSWORD: "BusRide@2024Secure!"` (compose líneas 8/20/38/69 y **también en `.env.example:8`** — no es placeholder) y `JWT_SECRET: "busride-jwt-secret-change-in-production"` (compose:72). Están en el historial de git → **rotar todos** y externalizar (`env_file`/secrets).
2. **Backend conecta como `sa`** — crear usuario de aplicación con privilegios mínimos.
3. **Sin servicio de frontend ni nginx** en el compose — el frontend no tiene forma de desplegarse.
4. **Compose solo de desarrollo**: `NODE_ENV: development`, `start:dev`, bind mount de `src`. No existe variante de producción.
5. **Sin TLS/HTTPS** en ninguna capa.
6. **Sin CI/CD** (ningún pipeline en el repo).
7. **Admin seed** `admin@busride.do / Admin123!cambiar` con hash commiteado y password documentada en el repo, sin forzar cambio en primer login.

---

## 5. Plan de remediación sugerido (en orden)

1. ✅ Validar e2e y commitear la ola pendiente del frontend (esta sesión).
2. ✅ Rotar y externalizar secretos + validación de entorno al boot (esta sesión — ver §6).
3. ✅ Empaquetado de producción: Dockerfile multi-stage backend, Dockerfile+nginx frontend, `docker-compose.prod.yml` (esta sesión — ver §6 y `docs/DESPLIEGUE.md`). TLS queda documentado (terminación en proxy del host o extender nginx).
4. ✅ Usuario de BD no-`sa` (`busride_app`) + cambio forzado de password del admin seed (esta sesión — ver §6).
5. ✅ Endurecimiento runtime: helmet, CORS estricto (fallar si falta `CORS_ORIGIN` en prod), Swagger gateado, logging estructurado + filtro global de excepciones (2026-07-02 — ver §6). Incluyó también cifrado de BD configurable (riesgo backend #3) y `logging` del CLI no fijo (riesgo #6).
6. Migración baseline de TypeORM + documentar evolución de esquema/SPs.
7. CI básico: build + lint + tests unitarios (caché limpia de jest) + build frontend; e2e opcional con services.
8. Decidir el destino de Redis (cablear o eliminar).

---

## 6. Registro de acciones de esta sesión

- **2026-07-01**: Auditoría ejecutada (3 agentes paralelos: backend, frontend, infra). Este documento es el registro.
- **2026-07-01**: Suite e2e de Playwright ejecutada contra el stack real (SQL Server en Docker + backend local en :3002): **5/5 tests verdes**. Dos ajustes durante la corrida: puerto del `ng serve` de e2e 4300 → 4310 (conflicto con un dev server ajeno en el host) y regex del countdown en `pasajero.spec.ts` (el texto renderizado lleva espacios y `toHaveText` con RegExp no normaliza).
- **2026-07-01**: Ola pendiente del frontend commiteada (refactor + suite e2e; ver historial de git).
- **2026-07-01 — Paso 2 (secretos) ejecutado**:
  - `SA_PASSWORD` rotada en caliente (`ALTER LOGIN sa`) y `JWT_SECRET` regenerado (`openssl rand -hex 32`). Los valores antiguos del historial de git quedan inservibles.
  - `docker-compose.yml` ya no contiene secretos: interpola `${SA_PASSWORD:?}` / `${JWT_SECRET:?}` desde `busride-app/.env` (ignorado por git; plantilla nueva `busride-app/.env.example`) y falla con mensaje claro si faltan. Healthcheck usa `$$SA_PASSWORD`. Eliminado el `version:` obsoleto.
  - `database/init.sh` sin fallback hardcodeado de password; `backend/.env.example` sin la password real.
  - **Validación fail-fast al boot** (`backend/src/config/env.validation.ts`, cableada en `ConfigModule.forRoot({ validate })`): exige `DB_PASSWORD`, `JWT_SECRET` ≥ 32 chars (y rechaza secretos de desarrollo conocidos en producción), `CORS_ORIGIN` concreto (≠ `*`) en producción y variables numéricas válidas. 7 tests unitarios nuevos (141/141 verdes).
  - Verificado: build + lint limpios, compose OK con `.env` y error explícito sin él, backend reiniciado con secretos nuevos y login del seed admin funcional.
  - _Pendiente relacionado (pasos 3-4): usuario de BD no-`sa`, password del admin seed, TLS._
- **2026-07-01 — Paso 3 (empaquetado de producción) ejecutado**:
  - `backend/Dockerfile` multi-stage: target `development` (lo usa el compose de dev) y target `production` (npm ci --omit=dev, `USER node`, `NODE_ENV=production`, `node dist/main.js` directo, HEALTHCHECK). Nuevo endpoint público `GET /api/v1/salud` (`app.controller.ts`) para healthchecks/LB.
  - `frontend/Dockerfile` (build node 24 + runtime nginx:1.27-alpine) y `frontend/nginx.conf`: SPA fallback, proxy mismo-origen `/api/` y `/socket.io/` (upgrade WS) → backend, gzip, cache inmutable de estáticos hasheados.
  - `docker-compose.prod.yml`: NODE_ENV=production, SQL Server sin puerto publicado, restart policies + healthchecks en todo, sin Redis (sin uso), secretos `${VAR:?}`, `CORS_ORIGIN` obligatorio, sin `container_name` fijos (permite stacks paralelos con `-p`).
  - `.dockerignore` en backend y frontend; compose de dev fijado a `target: development`.
  - Guía de despliegue nueva: `docs/DESPLIEGUE.md` (secretos, arranque, TLS, operación, dev vs prod).
  - Hallazgos corregidos durante el smoke test: build del frontend requiere node 24 (npm 10 rechaza peerDeps anidados del lock, @zxing exige node ≥ 24); entry del backend en imagen es `dist/main.js` (sin `test/` en contexto, tsc usa rootDir=src); healthcheck nginx con `127.0.0.1` (localhost → ::1 y nginx escucha IPv4).
  - **Smoke test PASADO** en stack aislado (`-p busride_prod`, :8080): SPA servida, fallback de rutas Angular, login del seed vía nginx, `/salud`, handshake Socket.IO, y los 3 servicios `healthy`. Stack de prueba destruido tras la verificación. 141/141 tests unitarios verdes.
- **2026-07-01 — Paso 4 (credenciales BD y admin seed) ejecutado**:
  - **Usuario de BD `busride_app`** con privilegios mínimos (db_datareader + db_datawriter + GRANT EXECUTE, sin DDL) creado por `database/init/05_app_user.sql` (idempotente; re-ejecutar rota/sincroniza la password con `APP_DB_PASSWORD`). Ambos composes y el backend local conectan ahora con `busride_app` — **`sa` ya no se usa en runtime** (solo en el init).
  - **Cambio forzado de password del admin seed**: columna `usuarios.debe_cambiar_password` (en `02_schema.sql` para BDs nuevas; `06_forzar_cambio_password_admin.sql` parchea BDs existentes y marca al admin solo si conserva el hash publicado). El login devuelve `debeCambiarPassword` y emite el claim `dcp` en el access token; `PasswordCaducadaGuard` (global, tras JwtAuthGuard) bloquea con 403 **en producción** todo salvo `POST /auth/cambiar-password` y logout (`@PermitirPasswordCaducada`). El endpoint valida la password actual, exige nueva ≠ actual (mín. 8), revoca todos los refresh tokens y emite un par nuevo sin el claim.
  - Frontend: página `/cambiar-password` (authGuard, cualquier rol), redirect automático tras login si el flag está activo, y `AuthService.cambiarPassword` que persiste el par de tokens nuevo. E2E: `global-setup.ts` deja al admin seed operativo con la credencial documentada (cambio ida y vuelta) antes de los specs.
  - Verificado: flujo manual completo contra el backend real (flag → cambio → restauración → flag limpio), **149/149 tests unitarios** (8 nuevos: `cambiarPassword` + `PasswordCaducadaGuard`), build/lint/tsc limpios en ambos lados y **5/5 e2e verdes con el usuario `busride_app`**.
- **2026-07-02 — Paso 5 (endurecimiento runtime) ejecutado** (iniciado el día anterior; interrumpido por un reinicio de la máquina y retomado/verificado en esta sesión):
  - **helmet + compression** en `main.ts`. La CSP por defecto de helmet rompe el UI de Swagger (scripts inline), así que se relaja solo fuera de producción; en producción va la CSP completa.
  - **CORS estricto**: `CORS_ORIGIN` admite lista separada por comas; se eliminó el fallback `'*'`. En producción la validación de entorno ya exige la variable; en desarrollo sin variable queda abierto (se usa el proxy de ng serve).
  - **Swagger gateado**: apagado con `NODE_ENV=production` salvo opt-in explícito `SWAGGER_HABILITADO=true`.
  - **`HttpExceptionFilter` global** (`common/filters/`): loguea todo 5xx con método/ruta/stack (antes se perdía), responde 500 genérico sin detalles internos para errores no controlados, y **preserva exactamente el shape de error por defecto de Nest** del que dependen el frontend y los e2e. Re-lanza en contextos WS. 4 tests unitarios.
  - **`LoggingInterceptor` global** (`common/interceptors/`): log por request de método, ruta, status y duración.
  - **Cifrado de conexión a BD configurable** (`DB_ENCRYPT` / `DB_TRUST_SERVER_CERTIFICATE`, riesgo backend #3) en ambos datasources, con defaults para la red interna de Docker; `data-source.ts` además: `logging` solo en development (riesgo #6) y default de usuario `busride_app` alineado con `database.config.ts`.
  - Los `console.log` del bootstrap reemplazados por `Logger`; `.env.example` documenta las variables nuevas.
  - **Verificado**: build + lint limpios, **153/153 tests unitarios** (14 suites, caché limpia de jest) y smoke test contra el stack real (SQL Server en Docker + backend local en :3002): cabeceras de helmet presentes, CORS permite el origen configurado y bloquea orígenes ajenos, Swagger 200 en dev, login del seed OK y log `[HTTP] POST /api/v1/auth/login 200` visible.
