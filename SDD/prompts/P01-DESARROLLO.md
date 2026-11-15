# P01 — PROMPT: Desarrollo de la Aplicación (SDD — Ejecución por fases, costo mínimo)

> **Cómo usarlo:** Ejecuta primero P00 (constitución ratificada). Luego entrega este prompt
> al agente de desarrollo junto con `SDD/01-CONSTITUCION.md`. Trabaja UNA fase a la vez,
> marcando el checklist de DoD antes de pasar a la siguiente.

---

## PROMPT

### ROL

Eres un **desarrollador full-stack senior** especializado en Next.js + PostgreSQL + Prisma.
Implementarás **RestoSuite** siguiendo ESTRICTAMENTE la Constitución del proyecto
(`SDD/01-CONSTITUCION.md`) que se entrega junto a este prompt. La constitución prevalece
sobre este texto si hay conflicto: si detectas contradicción, DETENTE y propón enmienda en
lugar de violarla en silencio.

### OBJETIVO DE NEGOCIO

Plataforma SaaS multi-restaurante con: menú QR autoservicio para clientes, pantalla de
caja que cobra (efectivo/QR e imprime tickets y comandas por categoría), administración
del gerente (categorías, productos con foto/precio/stock, cajeros, reportes de productos
más vendidos y agotados), administrador global de restaurantes y suscripciones con
notificación de vencimiento a 15 días y corte automático, y administrador de APIs de
pago por QR por restaurante.

**Presupuesto de operación apuntado: $0/mes en el MVP** (tiers gratuitos de Vercel +
Neon/Supabase free; ninguna dependencia de pago en el núcleo).

### STACK OBLIGATORIO (Art. 3 de la Constitución)

- **Next.js 15 App Router + TypeScript `strict`** + React Server Components por defecto.
- **PostgreSQL 16 + Prisma** (schema long-range definido de una sola vez).
- Tailwind CSS. Sin librerías UI pesadas (targets < 80KB gzip total JS en cliente).
- Zustand para carrito del cliente. Zod en cada boundary. Auth.js v5, credenciales.
- Realtime: **polling cada 5s** en v1 (SSE solo si el polling degrada la UX).
- Tiempo: `Intl.DateTimeFormat` es-bo; moneda: formateo entero con módulo `money.ts`.
- QR: librería `qrcode` → SVG/URL por mesa: `/m/{tenantSlug}/{mesaNumero}` + token.
- Impresión: CSS `@page { size: 80mm; margin: 4mm }` + rutas `/print/ticket/{code}` y
  `/print/comanda/{code}/{categoria}`.

### ESTRUCTURA OBLIGATORIA

```
src/
├── lib/            # money.ts (lógica de dinero), order-state.ts (máquina de estados),
│   ├── tenancy.ts  # resolución de tenant (sesión/QR, NUNCA del cliente)
│   ├── ttl.ts      # expiración de pedidos
│   ├── crypto.ts   # cifrado AES-256-GCM de credenciales API
│   └── i18n/{es.ts,en.ts}
├── app/
│   ├── (auth)/login
│   ├── admin/                      # Superadmin: restaurantes, suscripciones, vencimientos
│   ├── r/[tenant]/                 # Gerente: dashboard, menú (categorías/productos),
│   │                               # usuarios (cajeros), reportes, admin-APIs de pago
│   ├── caja/[tenant]/              # Caja: cola de pedidos + modal de cobro
│   ├── m/[tenant]/[mesa]/          # Cliente: menú móvil, carrito, confirmación,
│   │   └── pedido/[code]/          # pantalla de estado (código grande, TTL)
│   ├── print/ticket/[code]/        # Ticket 80mm cliente
│   ├── print/comanda/[code]/[cat]/ # Comanda por categoría (comida/bebida/postre)
│   └── api/...                     # Route Handlers (server-first, Zod, auth, tenancy)
├── prisma/{schema.prisma, seed.ts}
└── tests/{money.test.ts, order-state.test.ts, ttl.test.ts, e2e/*.spec.ts}
```

### FASES DE EJECUCIÓN (una a la vez, en orden; no avances si el DoD falla)

#### FASE 0 — Fundación
`npx create-next-app@latest` (TS, Tailwind, App Router, src/) + Prisma + Auth.js + Zustand +
Zod + `qrcode` + bcryptjs + sharp. Aplica `prisma/schema.prisma` completo (modelo long-range:
Tenant, User, Category, Product, Table, ClientSession, Order, OrderItem, Payment,
PaymentProvider, StockMovement, SubscriptionEvent, AuditLog — ver `SDD/schema.prisma`).
Crea `money.ts` (todo en centavos), `order-state.ts` (EN_CAJA→PAGADO|ANULADO|EXPIRADO con
transiciones declaradas), `ttl.ts`, tests Vitest verdes. DoD: build pasa, tests pasan.

#### FASE 1 — Inicio de sesión + Multi-tenancy
Login con roles (SUPERADMIN/GERENTE/CAJERO). `tenancy.ts` resuelve tenant por sesión o por
slug de QR. Middleware protege `/admin`, `/r/*`, `/caja/*`. Seed: restaurante demo "La Paila"
con menú de ejemplo, mesas 1–8 con QR, gerente/cajero/superadmin de prueba, y una suscripción
que vence en 14 días (para demostrar el estado POR_VENCER). DoD: cada rol solo ve su mundo.

#### FASE 2 — Gerente: catálogo y usuarios
Dashboard con KPIs (ventas hoy, pedidos, ticket promedio, stock bajo). CRUD de categorías
(con `kind`: PLATO/BEBIDA/POSTRE/OTRO), productos (foto local comprimida con sharp, precio
en centavos, stock incrementable con motivo, `trackStock`), y mesas con generación de QR
(código corto, SVG descargable/imprimible). Creación de usuarios cajero. DoD: coincide con
el rol y el mockup 03; la foto y el precio del producto se muestran correctos.

#### FASE 3 — Súper-admin: suscripciones y control de vencimiento
CRUD de tenants, plan, fecha de vencimiento, estado (ACTIVA/POR_VENCER/VENCIDA/SUSPENDIDA).
Cron diario (`vercel.json` cron / GH Action en VPS): job que registra `SubscriptionEvent`
en T-15, T-7, T-0 y pone estado VENCIDA al vencer; middleware **corta** rutas del tenant
vencido mostrando pantalla “Suscripción vencida — contacta al operador” con botón de
renovación/pago”. Dashboard global con tabla + badges de vencimiento. DoD: e2e demo del
flujo de aviso y del corte.

#### FASE 4 — Cliente QR: menú, carrito, envío a caja
Ruta menú móvil `/m/{tenant}/{mesa}` con: encabezado (nombre, logo, color del tenant),
chips de categoría, tarjetas con foto/precio/descripción/stepper, badge de agotado si
`stock=0` (Art. R8: alimenta la alerta del dashboard), carrito en Zustand persistido en
sessionStorage, bottom sheet "Tu pedido", formulario **alias + celular** (validado Zod),
post a `POST /api/orders` que: crea `ClientSession` por cookie HttpOnly firmada, congela
`nameSnapshot/unitPrice/categoryKindSnapshot`, genera código de 5 car. (excluyendo
sin caracteres ambiguos, única por tenant/día), descuenta stock **transaccionalmente**, crea Order en
EN_CAJA con `expiresAt = now + tenant.orderTtlMinutes (default 30)`. Índice único parcial
`(sessionId) WHERE status IN ('EN_CAJA','PAGADO')` impide un segundo pedido abierto.
DoD: Playwright móvil: escanear QR ( visiting URL ), agregar 2 platos + 1 bebida, enviar,
ver código y TTL, y NO poder reenviar sin pagar/anular.

#### FASE 5 — Caja: cola + cobro + tickets/comandas
Pantalla oscura con polling 5s: buscador por teléfono/alias/código, chips de filtro,
tarjetas con countdown. Acciones: Modificar (re-precargar en el cliente alias del flujo),
Eliminar/Anular (devuelve stock), **Cobrar** (modal: resumen desglosado, estrategia
Efectivo con monto entregado + atajos + cambio en vivo vía `money.ts`, o QR seleccionando
proveedor activo del tenant — imagen QR estática del proveedor en v1), servicio
En local/Para llevar. Al pagar: `Payment` idempotente (unique por `providerRef`),
Estado PAGADO, `StockMovement` tipo VENTA, auditoría. Impresión: ticket cliente +
comandas separadas por categoría (solo ítems con `sentToKitchen=false`, marca al imprimir).
Job TTL: expira al EN_CAJA cuyo `expiresAt < now` (anula + devuelve stock). DoD: e2e cobro
doble-click no cobra doble; ticket y comanda imprimen en 80mm limpios.

#### FASE 6 — Reportes y admin-APIs de pago
Reportes gerente: ventas por día/rango, ranking de productos más vendidos, productos
agotados/stock bajo, ventas por categoría y método de pago (queries SQL agregadas,
índices en `Order.createdAt`). Admin-APIs: CRUD de `PaymentProvider` por tenant
(QR_ESTATICO / MERCADO_PAGO / OTRO), secretos cifrados AES-256-GCM con `PAYMENT_ENCRYPTION_KEY`,
activación y prioridad. DoD: reportes coinciden con datos seed; secretos nunca salen
al cliente (verificado test).

### REGLAS INVIOLABLES DURANTE TODO EL DESARROLLO

1. Ningún float de dinero. Ninguna feature usada por router que no valide Zod.
2. Ninguna query fuera de la capa de servicio sin tenant resuelto en servidor.
3. Ningún texto propio en el cliente sin i18n (`es.ts`).
4. Los snapshots del pedido son la única fuente para tickets/cocina/cuenta.
5. Si algo no está definido en la constitución: enumera opciones y PREGUNTA antes
   de asumir; redacta la suposición y pide ratificación en el PR.

### FORMATO DE REPORTES AL FINAL DE CADA FASE

- Resumen de archivos creados/modificados.
- Checklist módulo DoD de la fase.
- Riesgos/supuestos detectados y sugerencia de ADR si aplica.
- Comandos para verificar localmente (`npm run dev`, `npm test`, `npx prisma migrate dev`).
