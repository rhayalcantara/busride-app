# BusRide Frontend — Tareas secuenciadas para subagentes

> Convención idéntica al backend (`TAREAS.md`): cada tarea lista **Depende de**, **Archivos en propiedad** y **Criterio de aceptación**. Las olas son barreras: no arranca F(N+1) hasta cerrar F(N) con `npm run build` + lint en verde (y tests desde la Ola F4).
> Rutas relativas a `busride-app/frontend/` salvo indicación contraria. El backend corre en `http://localhost:3002` (local) con la BD del contenedor `busride_sqlserver`.

## Grafo de dependencias

```
Ola F1:                 F-01 (scaffold + tooling)                  [secuencial]
                ┌──────────────┼──────────────┐
Ola F2:       F-02           F-03           F-04                   [paralelo]
            core/auth      core/api       shared+socket
                └──────────────┼──────────────┘
Ola F3:                 F-05 (wiring + login + shells)             [secuencial]
                ┌──────────────┼──────────────┐
Ola F4:       F-06           F-07           F-08                   [paralelo]
            pasajero       conductor      panel admin
                └──────────────┼──────────────┘
Ola F5:                 F-09 (integración + e2e + build prod)      [secuencial]
Ola F6:                 F-10 (docs + cierre)                       [secuencial]
```

## Estructura de carpetas objetivo (la crea F-01, la llenan F-02…F-08)

```
frontend/src/app/
├── core/
│   ├── auth/        ← F-02 (servicio, interceptores, guards, modelos de sesión)
│   ├── api/         ← F-03 (servicios HTTP tipados + modelos de la API)
│   └── socket/      ← F-04 (cliente Socket.IO de tracking)
├── shared/          ← F-04 (layout shells, mapa Leaflet, tabla, pipes, toasts)
├── features/
│   ├── auth/        ← F-05 (páginas login/registro)
│   ├── pasajero/    ← F-06
│   ├── conductor/   ← F-07
│   └── panel/       ← F-08 (admin + asociación)
├── app.config.ts    ← F-01 crea; F-05 cablea providers (compartido: solo tareas secuenciales)
└── app.routes.ts    ← F-01 crea; F-05 define lazy routes (ídem)
```

---

## OLA F1 — Scaffold (1 subagente, secuencial)

### F-01 · Workspace Angular + tooling ✦ ÚNICA tarea autorizada a tocar `package.json`
- **Depende de**: nada.
- **Archivos en propiedad**: TODO `busride-app/frontend/` (lo crea), `.gitignore` raíz (añadir entradas de frontend si faltan).
- **Trabajo**:
  1. `ng new` en `busride-app/frontend` (standalone, routing, SCSS, sin SSR). Documentar la versión exacta de Angular instalada.
  2. Instalar TODAS las dependencias de olas posteriores: `@angular/material`, `leaflet` + `@types/leaflet`, `socket.io-client`, `@zxing/browser`; devDeps: `@playwright/test`, `prettier`. Nada de npm install en tareas posteriores.
  3. `proxy.conf.json`: `/api` y `/socket.io` → `http://localhost:3002` (ws: true); script `npm start` con proxy.
  4. `environments/`: `apiUrl` (`/api/v1` en dev vía proxy; absoluta en prod) y `wsUrl`.
  5. Tema Material 3 base (paleta + tipografía, modo claro), `styles.scss` con reset y variables; CSS de Leaflet importado.
  6. Estructura de carpetas vacía de arriba (con `.gitkeep` o `index.ts` placeholder), `app.routes.ts` mínimo (redirect a `/login` placeholder), prettier config coherente con el backend.
  7. Lint: el builder de lint del CLI (`ng lint` con angular-eslint) configurado.
- **Aceptación**: `npm run build` y `ng lint` en verde; `npm start` levanta y proxya `/api/v1` al backend (probar `GET /api/v1/api/docs` no — basta un curl al proxy con login del seed admin). Documentar versión de Angular y runner de tests por defecto.

---

## OLA F2 — Núcleo (3 subagentes en paralelo)

> Todas dependen de F-01. PROHIBIDO tocar `package.json`, `app.config.ts`, `app.routes.ts`, `styles.scss` y carpetas ajenas. PROHIBIDO `npm install`. Verificación individual SOLO con `npx ng build 2>&1` (no toca estado compartido) o `npx tsc --noEmit` si el build colisiona — coordinado: F-02/F-03/F-04 PUEDEN ejecutar build porque Angular compila a memoria en `ng build` con outputs separados… **regla práctica: solo `npx tsc --noEmit -p tsconfig.app.json`**; el `ng build` real lo hace el orquestador al cerrar la ola.

### F-02 · Autenticación y sesión (`core/auth/`)
- **Archivos en propiedad**: `src/app/core/auth/**`.
- **Trabajo**:
  1. Modelos: `Sesion`, `UsuarioSesion { id, nombre, apellido, email, rol }`, enum `Rol` con los valores en MINÚSCULA del backend (`admin`, `asociacion`, `conductor`, `pasajero`).
  2. `TokenStorage` (localStorage: accessToken + refreshToken).
  3. `AuthService` (signals: `usuario`, `estaAutenticado`, `rol`): `login()`, `registrar()` (solo pasajero — el DTO del backend no acepta rolId), `refrescar()`, `logout()` (llama a `POST /auth/logout` y limpia), `cargarSesion()` al boot (decodifica el JWT para expiración — sin libs, atob del payload).
  4. Interceptores funcionales: `authInterceptor` (añade Bearer salvo a `/auth/login|registrar|refresh`), `refreshInterceptor` (ante 401: UN solo refresh concurrente con cola de requests pendientes — el backend ROTA el token; si el refresh falla → logout y redirect a /login).
  5. Guards funcionales: `authGuard`, `rolGuard(roles[])` (redirige a la home del rol propio si no autorizado).
- **Restricción**: no registrar nada en `app.config.ts` (lo hace F-05). Usa `environment.apiUrl`.
- **Aceptación**: type-check limpio; unit tests del refresh con cola (mock HttpClient) si el runner lo permite sin tocar config compartida — si no, déjalos escritos y se ejecutan en F-05.

### F-03 · Servicios API tipados (`core/api/`)
- **Archivos en propiedad**: `src/app/core/api/**`.
- **Trabajo**: modelos TypeScript de TODAS las respuestas/DTOs y un servicio por módulo del backend (leer los controllers del backend como fuente de verdad: `busride-app/backend/src/modules/*/`):
  - `rutas.api.ts` (buscar con lat/lng/radio, crear con paradas, detalle, paradas con ubicación), `reservas.api.ts` (crear → `{ reservaId, qrToken, qrImagen, expiraEn }`, abordar, mias), `wallet.api.ts` (paquetes, mi-saldo, comprar con `referenciaExterna`, historial), `viajes.api.ts` (iniciar, mi-activo, posición, finalizar, pasajeros por parada), `flota.api.ts` (buses, horarios, asignaciones + `/asignaciones/mias`), `conductores.api.ts` (alta, me, por asociación, calificar), `asociaciones.api.ts` (CRUD + aprobar + usuario-admin), `usuarios.api.ts` (me, password, listado paginado, estado), `liquidaciones.api.ts` (mias, resumen, pagar), `auth.api.ts` (crear-usuario privilegiado para el panel).
  - Tipos espejo de los DTOs del backend (mismos nombres de campos camelCase; NO enviar campos extra — `forbidNonWhitelisted`).
- **Restricción**: servicios puros HttpClient + environment; sin estado, sin UI, sin tocar core/auth (los interceptores se encargan del token).
- **Aceptación**: type-check limpio; cada endpoint del backend usado por las features de F4 tiene método tipado (lista de cobertura en la respuesta final).

### F-04 · Shared UI + Socket (`shared/` y `core/socket/`)
- **Archivos en propiedad**: `src/app/shared/**`, `src/app/core/socket/**`.
- **Trabajo**:
  1. `core/socket/tracking-socket.service.ts`: conexión lazy a `environment.wsUrl + '/tracking'` con `auth: { token }` (lo lee de localStorage para no depender de core/auth), métodos `suscribirViaje(viajeId)` → Observable de `posicion_bus`, `desuscribirViaje`, `emitirPosicion(viajeId, lat, lng)`, manejo de reconexión.
  2. `shared/components/mapa/`: wrapper Leaflet standalone (inputs: centro, marcadores tipados, polyline; output: clic en mapa con lat/lng) — usable por las 3 áreas (tracking, selección de paradas).
  3. `shared/components/`: `shell` (toolbar Material + sidenav con items por rol vía input, botón logout via callback/output — sin importar AuthService para no acoplarse a F-02), `tabla-paginada` genérica, `confirm-dialog`, `estado-vacio`.
  4. `shared/pipes`: moneda DOP, fecha corta es-DO.
  5. `shared/utils`: comparador de UUIDs case-insensitive, generador de `referenciaExterna` única.
- **Restricción**: nada de rutas ni providers globales; componentes standalone autocontenidos.
- **Aceptación**: type-check limpio; el wrapper de mapa compila con tipos de Leaflet correctos.

---

## OLA F3 — Integración del núcleo (1 subagente, secuencial)

### F-05 · Wiring, login/registro y shells por rol
- **Depende de**: F-02, F-03, F-04.
- **Archivos en propiedad**: `app.config.ts`, `app.routes.ts`, `src/app/features/auth/**`, `src/index.html`, `styles.scss` (retoques), retoques transversales mínimos documentados para resolver fricciones F2↔F4.
- **Trabajo**:
  1. `app.config.ts`: `provideHttpClient(withInterceptors([auth, refresh, errores]))`, `provideRouter` con lazy routes, animaciones Material, locale es-DO.
  2. `features/auth/`: página de login (redirige según rol tras login) y registro de pasajero (validaciones espejo del `RegistrarDto`: email, password ≥8, nombre, apellido).
  3. `app.routes.ts`: `/login`, `/registro`, y 3 áreas lazy con `authGuard` + `rolGuard`: `/pasajero` (rol pasajero), `/conductor` (rol conductor), `/panel` (admin|asociacion). Cada área carga `features/<area>/<area>.routes.ts` que F-05 crea con UNA página placeholder ("área en construcción") — así F-06/07/08 NO tocan archivos compartidos: solo editan el routes de SU área.
  4. Interceptor de errores global: 403 → snackbar "Sin permisos"; 5xx → snackbar genérico; 401 lo gestiona el refresh.
  5. Verificación REAL contra el backend (contenedor + `node dist/src/main.js` o start:dev en 3002): login con el seed admin entra a `/panel`; registro de pasajero nuevo entra a `/pasajero`; refresh automático tras expiración simulada (token corto o borrado del access) funciona; logout limpia y redirige.
- **Aceptación**: `npm run build` + `ng lint` en verde; los unit tests de F-02 corren; flujo login/registro/refresh/logout probado contra el backend y documentado en `docs/VERIFICACION-FRONTEND.md` (crearlo, sección "Ola F3").

---

## OLA F4 — Features por rol (3 subagentes en paralelo)

> Dependen de F-05. Cada tarea posee EXCLUSIVAMENTE `src/app/features/<su-area>/**` (incluido su `<area>.routes.ts`). PROHIBIDO tocar app.config/app.routes/package.json/core/shared y áreas ajenas. Si un servicio de `core/api` tiene un bug/falta un método: repórtalo, no lo edites (lo consolida F-09). Type-check con `npx tsc --noEmit -p tsconfig.app.json`; el build real al cierre de ola. Todas las páginas: Material + responsive móvil primero (pasajero/conductor se usan en el teléfono).

### F-06 · Área Pasajero (`features/pasajero/`)
- **Páginas**: 
  1. **Buscar ruta** (home): mapa Leaflet con "mi ubicación" (Geolocation API) + destino por clic; radio configurable; resultados de `sp_buscar_rutas_disponibles` como cards (ruta, tarifa, asientos); detalle con paradas dibujadas.
  2. **Reservar**: elegir parada origen/destino de la ruta → `POST /reservas` → pantalla de QR (muestra `qrImagen` base64 + countdown 5:00 desde `expiraEn`; al expirar, ofrecer regenerar).
  3. **Viaje en vivo**: tras reservar, `suscribirViaje` y pintar el bus moviéndose en el mapa.
  4. **Wallet**: saldo, catálogo de paquetes, compra (genera `referenciaExterna` única; manejar respuesta `idempotente`), historial.
  5. **Mis reservas**: lista con estado; desde una ABORDADA reciente → **calificar conductor** (estrellas + comentario).
  6. Guard de perfil: si el wallet da 404 de perfil → mensaje claro.
- **Aceptación**: type-check limpio; demo manual contra backend documentada en la respuesta final (búsqueda real con las paradas seed del e2e o creadas vía Swagger).

### F-07 · Área Conductor (`features/conductor/`)
- **Páginas**:
  1. **Inicio**: `GET /flota/asignaciones/mias` + `GET /viajes/mi-activo`; botón iniciar viaje (elige asignación activa).
  2. **Viaje activo** (pantalla principal): mapa con mi posición; al iniciar, `watchPosition` emite `actualizar_posicion` por socket cada ~5s (throttle); lista de paradas con pasajeros esperando (`GET /viajes/:id/parada/:paradaId/pasajeros` bajo demanda, no polling); asientos disponibles en vivo.
  3. **Abordar**: escáner QR con @zxing/browser (cámara trasera) + fallback de pegar token; al leer → form de número de asiento → `POST /reservas/abordar`; feedback éxito (ticket, asiento, asientos restantes) o error del SP.
  4. **Finalizar viaje**: confirmación → muestra la liquidación generada (bruto/comisiones/neto).
  5. **Liquidaciones**: historial + resumen por período.
- **Aceptación**: type-check limpio; demo manual del ciclo iniciar→emitir GPS→abordar (token pegado, sin cámara)→finalizar contra el backend, documentada.

### F-08 · Área Panel admin/asociación (`features/panel/`)
- **Páginas** (sidenav; visibilidad de items según rol admin vs asociacion):
  1. **Usuarios** (solo admin): tabla paginada (`GET /usuarios`), activar/desactivar, crear usuario privilegiado (`POST /auth/usuarios` con selección de rol).
  2. **Asociaciones** (admin): CRUD + aprobar + vincular usuario-admin.
  3. **Conductores** (admin/asociacion): alta (form completo de licencia), listado por asociación con calificación.
  4. **Flota**: buses (CRUD), horarios por ruta, asignaciones bus-ruta-conductor (crear/desactivar) con manejo de los 409 del backend.
  5. **Rutas**: listado por asociación; **crear ruta** con el wrapper de mapa: clic para añadir paradas en orden (mín. 2, nombre + terminal), tarifa, polyline opcional dibujada de las paradas.
  6. **Liquidaciones** (admin): pendientes → marcar pagada con referencia.
- **Aceptación**: type-check limpio; demo manual (seed admin) creando asociación→conductor→bus→ruta→asignación contra el backend, documentada.

---

## OLA F5 — Integración final + E2E (1 subagente, secuencial)

### F-09 · Integración, Playwright y build de producción
- **Depende de**: F-06, F-07, F-08.
- **Archivos en propiedad**: todo `frontend/` + `busride-app/docker-compose.yml` (servicio frontend opcional) + `docs/VERIFICACION-FRONTEND.md`.
- **Trabajo**:
  1. Resolver fricciones reportadas por F-06/07/08 (métodos faltantes en core/api, ajustes de shared) — cambios mínimos documentados.
  2. Pulido transversal: títulos de página, loading states, manejo de errores coherente, navegación post-login por rol, 404.
  3. **E2E Playwright** (`frontend/e2e/`): contra backend real (arranca/usa contenedor + API): (a) auth: login admin, registro pasajero, logout; (b) pasajero: comprar paquete + reservar y ver QR; (c) conductor: iniciar viaje y abordar con token pegado; (d) panel: crear bus. Datos únicos por corrida (lección backend). Config con webServer de Playwright levantando `ng serve` con proxy.
  4. `ng build --configuration production` limpio (presupuestos ajustados si hace falta, justificado).
  5. Opcional si el tiempo da: Dockerfile nginx (build multi-stage + proxy /api al backend) y servicio `frontend` en docker-compose.
- **Aceptación**: build prod + lint + unit + **Playwright en verde**; `docs/VERIFICACION-FRONTEND.md` sección "Ola F5" con evidencia paso a paso.

---

## OLA F6 — Cierre (1 subagente, secuencial)

### F-10 · Documentación y cierre
- **Depende de**: F-09.
- **Archivos en propiedad**: `README.md` (raíz — añadir sección frontend), `frontend/README.md`, `CLAUDE.md` (sección frontend: comandos, arquitectura, convenciones), `docs/**`.
- **Trabajo**: README con arranque (proxy, puertos, seed admin), mapa de áreas/rutas, actualizar `PLAN-FRONTEND.md` con estado final y este archivo con la tabla de estado; deuda pendiente listada (PWA/notificaciones push, modo offline, i18n, accesibilidad auditada).
- **Aceptación**: verificación completa final (build prod + lint + unit + e2e) repetida en verde.

---

## Estado de tareas

| Tarea | Ola | Estado |
|---|---|---|
| F-01 Scaffold + tooling | F1 | ⬜ Pendiente |
| F-02 Core auth + interceptores + guards | F2 | ⬜ Pendiente |
| F-03 Servicios API tipados | F2 | ⬜ Pendiente |
| F-04 Shared UI + socket tracking | F2 | ⬜ Pendiente |
| F-05 Wiring + login/registro + shells | F3 | ⬜ Pendiente |
| F-06 Área Pasajero | F4 | ⬜ Pendiente |
| F-07 Área Conductor | F4 | ⬜ Pendiente |
| F-08 Área Panel admin/asociación | F4 | ⬜ Pendiente |
| F-09 Integración + Playwright + build prod | F5 | ⬜ Pendiente |
| F-10 Docs y cierre | F6 | ⬜ Pendiente |
