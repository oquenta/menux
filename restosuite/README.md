# RestoSuite — Sistema de Administración de Restaurantes (SaaS multi-tenant)

Aplicación web completa y funcional: Next.js 15 (App Router, TypeScript strict) + Prisma + SQLite (portable a PostgreSQL cambiando el provider del schema) + Tailwind con sistema de color unificado.

## ▶️ Ejecutar

```bash
npm install
npm run db:push     # crea dev.db + carga datos demo (La Paila, mesas 1–8, pedidos)
npm run dev         # http://localhost:3100
```

> Si el puerto 3100 está ocupado, cambia en `package.json`.

## 🔑 Cuentas demo (contraseña: `demo1234`)

| Rol | Correo | Panel |
|---|---|---|
| Operador SaaS | `admin@resto.app` | `/admin` — restaurantes, vencimientos, renovación |
| Gerente La Paila | `gerente@paila.app` | `/r/la-paila/dashboard` |
| Cajero La Paila | `cajero@paila.app` | `/caja/la-paila` |

## 🗺 Superficies

- `/` landing con cuentas demo
- `/login` acceso por rol (sesión HMAC httpOnly)
- `/admin` dashboard global: MRR, POR VENCER ≤15d, VENCIDAS, renovar contrato
- `/r/{slug}/dashboard` · `/menu` · `/tables` (QR por mesa) · `/reports` · `/staff`
- `/caja/{slug}` cola viva (polling 4s) + buscador + **“+ nuevo”** manual + cobro (efectivo con vuelto / QR) + ticket/comandas
- `/m/{slug}/{mesa}` menú del cliente por QR → confirmación con cuenta atrás TTL 30 min
- `/print/ticket/{code}` y `/print/comanda/{code}/{PLATO|BEBIDA|POSTRE}` impresión 80mm

## ✅ Reglas de negocio verificadas (tests/e2e-flow.mjs — ejecutar con el servidor activo)

- R4 · alias+celular obligatorios en el envío
- R5 · un pedido abierto por mesa (HTTP 409 si se repite)
- R6 · TTL 30 min con expiración y devolución de stock
- R7 · comandas separadas PLATO/BEBIDA/POSTRE (solo con ítems, marca `sentToKitchen`)
- R9 · suscripción: badges ACTIVA / POR VENCER≤15d / VENCIDA + bloqueo HTTP 402 + renovación
- R10 · stock transaccional decrementado con la venta y devuelto al anular
- Art. II · cobro no idempotente bloqueado (doble POST → 400)
- Art. III · dinero en centavos enteros + snapshot de precio del pedido

## 🔄 Migrar a PostgreSQL en producción

Reemplaza en `prisma/schema.prisma`: `provider = "postgresql"`, `DATABASE_URL="postgresql://…"`,
y levanta con `npx prisma migrate dev`. El Uso General es idéntico (`db.push` para demo).
