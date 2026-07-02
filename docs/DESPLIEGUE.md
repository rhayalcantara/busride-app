# Guía de despliegue a producción — BusRide

**Stack:** `busride-app/docker-compose.prod.yml` — SQL Server 2022 + backend NestJS compilado + frontend Angular servido por nginx (proxy mismo-origen).

## 1. Requisitos

- Docker Engine + Compose v2 en el host.
- Un dominio apuntando al host (para TLS).

## 2. Secretos

```bash
cd busride-app
cp .env.example .env
```

Completar `.env` (jamás commitearlo):

| Variable | Cómo generarla |
|---|---|
| `SA_PASSWORD` | `openssl rand -base64 18` + un símbolo (SQL Server exige 3 de 4 categorías) |
| `APP_DB_PASSWORD` | Igual que SA_PASSWORD. Password del login `busride_app` (privilegios mínimos: datareader/datawriter/execute) con el que se conecta el backend — nunca `sa` |
| `JWT_SECRET` | `openssl rand -hex 32` (la app rechaza < 32 chars y secretos de dev conocidos) |
| `CORS_ORIGIN` | Origen público del frontend, p. ej. `https://app.busride.do` |
| `FRONTEND_PORT` | Puerto HTTP publicado por nginx (default `80`) |
| `MSSQL_PID` | Edición de SQL Server según licenciamiento (default `Express`) |

El compose falla con mensaje explícito si falta un secreto (`${VAR:?}`), y el backend valida el entorno al arrancar (`src/config/env.validation.ts`) — no llega a aceptar tráfico mal configurado.

## 3. Arranque

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Orden automático: `sqlserver` (healthcheck) → `sqlserver-init` (one-shot idempotente: BD + schema + SPs + admin seed) → `backend` (healthcheck en `GET /api/v1/salud`) → `frontend` (nginx :80).

Solo nginx publica puerto al host; SQL Server y el backend viven en la red interna del stack.

## 4. Primer acceso

El init siembra `admin@busride.do` / `Admin123!cambiar` (credencial **pública**, está en el repo) **marcada con cambio de contraseña obligatorio**: en producción el backend bloquea todo el API (403) para ese usuario hasta que la cambie (`POST /auth/cambiar-password`; el frontend redirige a `/cambiar-password` automáticamente tras el login). El init re-marca al admin solo mientras conserve el hash publicado.

## 5. TLS

El stack sirve HTTP plano en `frontend:${FRONTEND_PORT}`. Opciones:

1. **Recomendado:** proxy con TLS en el host (Caddy, Traefik, nginx + certbot) apuntando a `http://localhost:${FRONTEND_PORT}`. WebSocket: el proxy debe pasar los headers `Upgrade`/`Connection` para `/socket.io/`.
2. Extender `frontend/nginx.conf` con `listen 443 ssl` y montar certificados en el contenedor.

## 6. Operación

- **Logs:** `docker compose -f docker-compose.prod.yml logs -f backend`
- **Actualizar versión:** `git pull && docker compose -f docker-compose.prod.yml up -d --build` (el init es idempotente; re-aplica SPs con `CREATE OR ALTER`)
- **Cambios de esquema:** hoy no hay migraciones TypeORM (ver auditoría §2) — los cambios de schema requieren SQL manual versionado en `database/init/`
- **Backups:** volumen `sqlserver_data`; respaldar con `BACKUP DATABASE busride_db` vía `sqlcmd` en el contenedor (pendiente automatizar)
- **Rotar secretos:** cambiar `.env` + `ALTER LOGIN sa WITH PASSWORD` en el contenedor (o recrear el stack); los JWT emitidos con el secreto viejo se invalidan al reiniciar el backend

## 7. Desarrollo vs producción

| | `docker-compose.yml` (dev) | `docker-compose.prod.yml` |
|---|---|---|
| Backend | `start:dev` + bind mount de `src` (target `development`) | imagen compilada, no-root, `node dist` (target `production`) |
| Frontend | `ng serve` local (proxy.conf) | nginx + bundle de producción |
| SQL Server | puerto 1433 publicado | solo red interna |
| Redis | eliminado (2026-07-02, auditoría §5 paso 8: el código nunca lo usó) | omitido |
| NODE_ENV | development | production (activa validaciones estrictas) |
