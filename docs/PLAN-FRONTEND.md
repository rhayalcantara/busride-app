# BusRide — Plan del Frontend (Angular)

> Fecha: 2026-06-10 · Depende del backend completado (ver `PLAN.md`, 16/16 tareas)

## 1. Contexto y alcance

El backend expone una API REST completa (`/api/v1`, Swagger en `/api/docs`), WebSocket de tracking (Socket.IO, namespace `/tracking`) y auth JWT con refresh rotation. El `CORS_ORIGIN` ya apunta a `http://localhost:4200`. No existe ninguna interfaz de usuario.

**Objetivo**: una única SPA Angular con tres áreas por rol (lazy-loaded), en español:

| Área | Rol | Funcionalidad |
|---|---|---|
| **Pasajero** | `pasajero` | Buscar rutas en mapa, wallet (paquetes/compra/historial), reservar con QR, seguir el bus en vivo, mis reservas, calificar conductor |
| **Conductor** | `conductor` | Mi asignación, iniciar/finalizar viaje, emitir GPS, pasajeros por parada, escanear QR de abordaje, liquidaciones |
| **Panel** | `admin` / `asociacion` | Usuarios, asociaciones (crear/aprobar), conductores, flota (buses/horarios/asignaciones), rutas (crear con paradas en mapa), liquidaciones |

## 2. Decisiones técnicas

| Tema | Decisión | Razón |
|---|---|---|
| Versión | Angular estable más reciente al ejecutar F-01 (20+), **standalone components + signals + nueva sintaxis de control flow** (`@if`/`@for`) | Sin NgModules; estado ligero sin NgRx |
| Ubicación | `busride-app/frontend/` (hermana de `backend/`) | Coherente con el monorepo |
| UI | **Angular Material 3** + theming propio | Componentes accesibles listos (tablas, forms, dialogs, snackbars) |
| Mapas | **Leaflet + OpenStreetMap** | Sin API key; tracking y selección de paradas con clic |
| Tiempo real | **socket.io-client** (namespace `/tracking`, token en `handshake.auth.token`) | Lo que espera `WsJwtGuard` del backend |
| QR pasajero | Mostrar el **PNG base64 que ya devuelve el backend** + countdown de 5 min | Cero dependencias extra |
| QR conductor | **@zxing/browser** (cámara) con fallback de input manual del token | Escaneo de abordaje |
| HTTP | `provideHttpClient` con interceptores funcionales: auth (Bearer), refresh con cola (rota el token en 401 y reintenta), errores globales (snackbar) | El backend usa refresh rotation: un solo refresh concurrente |
| Dev server | **Proxy de Angular** (`proxy.conf.json`) → `http://localhost:3002` (`/api` y `/socket.io`) | Evita CORS en desarrollo; el puerto 3002 es el del backend local (ver notas Ola 2 backend) |
| Estado | Servicios con signals (`signal`/`computed`); sesión en `localStorage` (tokens) | Suficiente para este tamaño |
| Tests | Unit con el runner por defecto del CLI elegido (documentar cuál); **E2E con Playwright** contra el backend real | Mismo espíritu que el backend: e2e contra sistema vivo |
| Formularios | Reactive Forms tipados | Validaciones espejo de los DTOs del backend |

## 3. Riesgos y puntos de contacto con el backend

- **Roles en minúscula** (`admin`, `asociacion`, `conductor`, `pasajero`) — el JWT trae `rol` así; los guards de ruta del frontend deben usar los mismos valores.
- **Registro público solo crea pasajeros** (B1): el panel crea usuarios privilegiados vía `POST /auth/usuarios` (admin). El primer admin es el seed (`admin@busride.do`).
- **Refresh rotation**: si dos requests refrescan a la vez, el segundo falla (el token rotó) — el interceptor DEBE serializar el refresh (cola).
- **ValidationPipe estricto** (`forbidNonWhitelisted`): no enviar campos extra en los bodies.
- **UUIDs en mayúsculas** desde SQL Server: comparar ids case-insensitive (lección de los e2e del backend).
- **Throttling activo** (100 req/60s por defecto): evitar polling agresivo; el tracking va por WS.
- Geolocalización del navegador requiere **HTTPS o localhost** (ok en dev).

## 4. Estrategia de olas (ver `TAREAS-FRONTEND.md`)

Mismas reglas anti-colisión del backend: propiedad exclusiva de archivos por tarea, archivos compartidos (`package.json`, `app.config.ts`, `app.routes.ts`, `styles.scss`) solo en tareas integradoras secuenciales, npm centralizado en F-01, olas como barreras con `ng build` + lint (+ tests desde F4) en verde.

| Ola | Contenido | Paralelismo |
|---|---|---|
| F1 | Scaffold del workspace, tooling, theming, proxy, estructura | 1 tarea (secuencial — `ng new` lo genera todo) |
| F2 | Núcleo: auth+interceptores, servicios API tipados, shared UI+socket | 3 tareas en paralelo |
| F3 | Integración: wiring de la app, login/registro, shells por rol, rutas lazy con placeholders | 1 tarea |
| F4 | Features: área pasajero, área conductor, área panel | 3 tareas en paralelo |
| F5 | Integración final + E2E Playwright + build producción + Docker/nginx | 1 tarea |
| F6 | Documentación y cierre | 1 tarea |

## 5. Criterio de éxito global

1. `ng build` de producción sin errores ni warnings de presupuesto.
2. E2E Playwright en verde contra el backend real (contenedor + seed): un flujo por rol (pasajero reserva y muestra QR; conductor inicia viaje y aborda; admin crea una asociación).
3. Flujo de negocio completo demostrable a mano: pasajero busca ruta → compra paquete → reserva → conductor escanea → mapa en vivo se mueve → liquidación visible.
4. Sin credenciales hardcodeadas; environments para API/WS URL.
