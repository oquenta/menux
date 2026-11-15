# Builder
FROM node:20-alpine AS builder
WORKDIR /app
COPY restosuite/package*.json ./
RUN npm ci
COPY restosuite/ ./
RUN npx prisma generate
RUN npm run build

# Runner
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/restosuite/node_modules ./node_modules
COPY --from=builder /app/restosuite/.next ./.next
COPY --from=builder /app/restosuite/prisma ./prisma
COPY --from=builder /app/restosuite/public ./public
COPY --from=builder /app/restosuite/next.config.mjs ./

EXPOSE 3000
CMD ["sh", "-c", "npx prisma db push && npx next start -p 3000"]
