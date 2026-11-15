# =============================================================
# RestoSuite - Dockerfile optimizado para despliegue en Coolify
# =============================================================

# 1. Base: Node 20 sobre Alpine con OpenSSL y compatibilidad libc para Prisma
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat

# 2. Dependencies: instalación limpia de paquetes
FROM base AS deps
WORKDIR /app
COPY restosuite/package*.json ./
RUN npm ci

# 3. Builder: generación de Prisma y compilación estática de Next.js
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY restosuite/package*.json ./
COPY restosuite/ ./
RUN mkdir -p /app/public

# Generar cliente de Prisma para PostgreSQL
RUN npx prisma generate

# Compilar la aplicación Next.js
ENV NODE_ENV=production
RUN npm run build

# 4. Runner: contenedor final de producción
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Copiar aplicación compilada y runtime completo
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/next.config.mjs ./

# Copiar y dar permisos al script de entrada (espera DB, sincroniza esquema y arranca)
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["npm", "run", "start"]
