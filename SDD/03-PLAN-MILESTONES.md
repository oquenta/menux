# PLAN Y MILESTONES — RestoSuite

## Estrategia de costo (más económica posible)
| Recurso | MVP ($0) | Alternativa |
|---|---|---|
| Hosting | Vercel Hobby | Docker en VPS barato (Hetzner ~$4/mes) |
| Base de datos | Neon/Supabase free tier (Postgres 16) | Postgres local + docker-compose |
| Imágenes de productos | Disco local (servidas por Next) | Supabase Storage / S3 R2 |
| Correos de vencimiento | Sin envío en MVP (solo in-app) | Resend free (3k/mes) |
| Tiempo real | Polling 5s | SSE (Next Route Handler) |
| Pasarelas de cobro QR | QR estático (imagen del banco) | Mercado Pago API / adapter |
| QR de mesas | `qrcode` npm (local) | — |

## Milestones
| # | Fase (ver P01) | Alcance | Criterio de cierre |
|---|---|---|---|
| M0 | Fundación | Repo, schema, módulos puros + tests | build+tests verdes |
| M1 | Auth + tenancy | Login por roles, seed La Paila, aislamiento | e2e de isolamiento |
| M2 | Backoffice gerente | Categorías, productos+foto+stock, mesas/QR, cajeros | e2e CRUD |
| M3 | Suscripciones | CRUD tenants, cron vencimientos, corte, avisos T-15/7/0 | demo vencimiento |
| M4 | Cliente QR | Menú, carrito, envío, TTL, exclusividad de pedido | e2e móvil completo |
| M5 | Caja | Cola viva, cobro idempotente, cambio, tickets/comandas | e2e cobro doble-safe |
| M6 | Reportes + APIs | Top ventas, agotados, admin PaymentProvider cifrado | reportes vs seed |

## Secuencia recomendada de impresión/pantallas
1. Menú cliente (mockup 04) → 2. Caja (mockup 03) → 3. Ticket/Comanda (mockup 05)
→ 4. Dashboards (mockups 01/02).

## Definition of Done global (por fase)
`npm run build` sin error · tests nuevos pasan · migraciones sin drift · responsive
verificado · audit log en eventos sensibles · i18n · DoD documentado en el PR.

## Riesgos y mitigaciones
1. **Impresoras térmicas**: el CSS de 80mm debe probarse con papel físico; export PDF fallback.
2. **Regla 30-min**: parametrizada por tenant para no romper cenas largas.
3. **Cron en Vercel Hobby**: 1 trabajo/día es suficiente (cheque de vencimientos).
4. **Stock concurrente**: transacción Prisma con decremento condicional (`updateMany where stock >= n`).
