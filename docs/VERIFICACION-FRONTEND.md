# Verificación del frontend BusRide

> Registro de evidencia por ola, espejo de la convención del backend. Cada tarea
> secuencial añade su sección al cerrar.

## Ola F3 (F-05) — Wiring, login/registro y shells por rol (2026-06-11)

### Qué se cableó

- **`app.config.ts`**: `provideHttpClient(withInterceptors([authInterceptor, refreshInterceptor, erroresInterceptor]))` (orden obligatorio: Bearer → refresh con cola ante 401 → snackbars globales), `provideRouter(routes)` y `provideAppInitializer(() => inject(AuthService).cargarSesion())` (la sesión se restaura ANTES de la primera navegación, así los guards ven el estado real).
- **`core/interceptors/errores.interceptor.ts`** (nuevo): 403 → snackbar "Sin permisos…"; 0/5xx → snackbar "Error del servidor…"; 401 no se toca (refreshInterceptor); 400/404/409 no se tratan globalmente (cada feature).
- **`features/auth/`**: `login/login.component.ts` (Material card, errores del backend en pantalla, redirige a `HOME_POR_ROL[rol]` respetando `?volverA=` del authGuard), `registro/registro.component.ts` (validaciones espejo del `RegistrarDto`: email válido, password ≥ 8, nombre y apellido obligatorios — el DTO del backend NO exige mayúscula/número; tras registrar hace login automático y entra a `/pasajero`), `no-encontrada/no-encontrada.component.ts` (404) y `mensaje-error.util.ts` (extrae `message: string | string[]` de los errores Nest). Se eliminó `login-placeholder.component.ts`.
- **`app.routes.ts`**: `/login`, `/registro` (públicas, lazy `loadComponent`); áreas lazy con `canActivate: [authGuard, rolGuard([...])]`: `/pasajero` (pasajero), `/conductor` (conductor), `/panel` (admin|asociacion); `''` con `redirectTo` funcional (home del rol si hay sesión, `/login` si no); `**` → página 404.
- **Shells por rol**: `features/pasajero/pasajero.routes.ts`, `features/conductor/conductor.routes.ts`, `features/panel/panel.routes.ts` — cada uno con UNA página placeholder standalone que envuelve `<app-shell>` (toolbar + sidenav de shared) con logout funcional. F-06/07/08 reemplazan SOLO su archivo.

### Fricción documentada (fuera de los archivos propios: ninguna; desviación del plan: una)

- **No se registró `provideAnimationsAsync`**: el paquete `@angular/animations` NO está instalado (F-01 no lo incluyó) y F-05 tiene prohibido tocar `package.json`. No bloquea: Angular Material 19+ usa animaciones CSS y ningún componente lo requiere (build, tests y snackbar/sidenav funcionan sin él). Si alguna feature de F4 lo necesitara, instalarlo en F-09. Queda comentado en `app.config.ts`.
- Tampoco se registró locale Angular `es-DO` (opcional según el plan: los pipes de shared usan `Intl` directamente). Evaluar en F-09 si el datepicker de Material lo pide.

### Unit tests

`npx ng test --watch=false --browsers=ChromeHeadless` → **22/22 SUCCESS** (0.6 s):

- `auth.service.spec.ts` (F-02): 12
- `refresh.interceptor.spec.ts` (F-02): 4
- `login.component.spec.ts` (nuevo F-05): 5 — creación; formulario vacío NO llama a la API; email inválido NO llama a la API; credenciales válidas llaman a `login` y navegan a `/panel` (rol admin); error 401 del backend se muestra en pantalla y apaga `cargando`.
- `app.spec.ts`: 1

### Build y lint

- `npx ng build` → verde (única advertencia preexistente: `leaflet` no es ESM). Chunks lazy generados por área: `login-component`, `registro-component`, `pasajero-routes`, `conductor-routes`, `panel-routes`, `no-encontrada-component`.
- `npx ng lint` → "All files pass linting."

### Verificación HTTP real contra el backend (puerto 3002, vía proxy de `ng serve` en 4200)

Se levantó `npx ng serve --port 4200` (proxy `proxy.conf.json` → 3002) y se ejecutó el flujo completo con `fetch` (script Node) contra `http://localhost:4200/api/v1`:

| Paso | Petición | Resultado |
|---|---|---|
| 1 | `POST /auth/login` admin seed (`admin@busride.do`) | **200**, `rol=admin`, accessToken + refreshToken presentes |
| 2 | `POST /auth/registrar` pasajero nuevo (email único `pasajero.f05.<timestamp>@correo.com`) | **201**, "Usuario registrado…" |
| 3 | `POST /auth/login` con el pasajero nuevo | **200**, `rol=pasajero` |
| 4 | `POST /auth/refresh` con su refreshToken | **200**, el refreshToken **ROTA** (distinto al anterior). Nota: el accessToken devuelto fue idéntico por emitirse en el mismo segundo (mismo `iat`/`exp` → mismo JWT determinista); no es un fallo. |
| 5 | `POST /auth/refresh` con el refreshToken VIEJO | **401** (rotación efectiva: el viejo deja de servir) |
| 6 | `GET /usuarios/me` con el access vigente | **200**, devuelve email y rol correctos (`GET /usuarios/me` SIN token → 401) |
| 7 | `POST /auth/logout` | **200** |
| 8 | `POST /auth/refresh` con el refreshToken vigente tras logout | **401** (revocación total confirmada) |

`ng serve` se detuvo al terminar; el backend en 3002 quedó intacto (login admin re-verificado → 200).

### Pendiente para verificación en navegador (F-09, Playwright)

Esta ola verificó HTTP + unit tests; queda para F-09 con navegador real:

- Click-through de login (admin → `/panel`, pasajero → `/pasajero`) y registro con login automático.
- `?volverA=`: entrar a una URL protegida sin sesión → login → volver a esa URL.
- Refresh automático del interceptor ante un 401 en vivo (access expirado/borrado) con cola de requests.
- Logout desde el botón del shell (limpia y redirige a `/login`).
- Snackbars del interceptor de errores (403 / 5xx) y página 404.
