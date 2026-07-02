# ============================================================
# Frontend BusRide — build Angular + nginx (producción).
# nginx sirve el SPA y proxya /api y /socket.io al servicio backend
# (ver nginx.conf); el frontend usa URLs relativas en producción.
# ============================================================

# ---- build: compila el bundle de producción ----
# node 24: @zxing/library exige node >= 24, y el npm 11 que trae resuelve los
# peerDependencies anidados (chokidar ^5) que el npm 10 de node 20 rechaza en npm ci
FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- production: nginx sirviendo el bundle ----
FROM nginx:1.27-alpine AS production
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/frontend/browser /usr/share/nginx/html
EXPOSE 80
# 127.0.0.1 explícito: en alpine "localhost" resuelve a ::1 y nginx escucha solo IPv4
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
