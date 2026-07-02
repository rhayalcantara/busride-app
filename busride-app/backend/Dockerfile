# ============================================================
# Backend BusRide — multi-stage.
#   development: la usa docker-compose.yml (start:dev + bind mount de src)
#   production:  imagen final mínima (dist + deps de producción, no-root)
# Build de producción: docker build --target production .
# ============================================================

# ---- deps: dependencias completas (incluye dev, para compilar y para dev) ----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# ---- development: target del compose de desarrollo ----
FROM deps AS development
ENV NODE_ENV=development
COPY . .
EXPOSE 3000
CMD ["npm", "run", "start:dev"]

# ---- build: compila TypeScript a dist/ ----
FROM deps AS build
COPY . .
RUN npm run build

# ---- prod-deps: solo dependencias de producción ----
FROM node:20-alpine AS prod-deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# ---- production: imagen final ----
FROM node:20-alpine AS production
ENV NODE_ENV=production
WORKDIR /app
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
# No-root: la imagen node trae el usuario "node" (uid 1000)
USER node
EXPOSE 3000
# node directo (sin npm): propaga SIGTERM para shutdown limpio.
# El healthcheck usa el endpoint público GET /api/v1/salud.
# Entry: dist/main.js — .dockerignore excluye test/, así que tsc usa rootDir=src
# y NO crea el nivel dist/src/ que sí existe en builds locales (npm run start:prod).
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:'+(process.env.PORT||3000)+'/api/v1/salud',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"
CMD ["node", "dist/main.js"]
