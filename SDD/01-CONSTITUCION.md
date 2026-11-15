# CONSTITUCIÓN DEL PROYECTO — RestoSuite

> **Documento Constitucional — Especificación v1.0.0 (Ratificado: 2026-11-08)**
> Este es el documento de **gobierno supremo** del sistema. Todos los soportes, planes,
> épicos y tareas DEBE cumplir estos principios. Una enmienda requiere su propia PR,
> aprobación y actualización de la versión (semver).

---

## 1. Nombre y Visión

**RestoSuite** es una **plataforma web SaaS multi-restaurante** de administración y
venta para gastronomía, donde cada restaurante es un **tenant personalizable** con
sus propios gerentes, cajeros, menú, proveedores de pago por QR (APIs), suscripción
por contrato (meses/años) y sus propios reportes.

**Visión (North Star):** que cualquier restaurante pequeño o mediano pueda operar
caja, menú, pedidos por QR e inventario desde su celular, tablet o PC — sin
comisiones por venta — y que el operador del SaaS gestione suscripciones con
cobro, aviso de vencimiento a 15 días y corte automático al vencer.

**Usuarios objetivo:** Operador del SaaS (superadministrador), Gerente de
restaurante, Cajero, Cliente (opcional, vía QR de mesa).

---

## 2. Principios Inmutables

### Artículo I — Multi-tenancy primero
Toda entidad de negocio lleva `tenantId`. Toda query se hace a través de la capa de
servicio con el tenant resuelto del **servidor** (sesión auth o slug del QR); un dato
de cliente nunca establece contexto de tenant. Un filtro de tenant olvidado **debe
fallar cerrado** (cero filas), nunca filtrar datos de otro restaurante. Se puede
reforzar con RLS de Postgres en fase 2.

### Artículo II — El servidor manda
Validación con **Zod** en cada boundary. El estado del pedido (`EN_CAJA → PAGADO |
ANULADO | EXPIRADO`) se rige por una **máquina de estados pura declarada en un
módulo**; ninguna pantalla decide transiciones ilegales. El cobro es **idempotente**:
un pago (webhook o confirmación) repetido **no-operea**.

### Artículo III — Dinero como enteros
Montos en **unidades menores (centavos)** en BD, API y UI. **Prohibidos floats.**
Cálculos de cambio y totales viven en un módulo puro (`money.ts`) con tests. Moneda
por tenant (default `BOB`). Los precios se **congelan al enviar el pedido**
(`nameSnapshot`, `unitPrice`, `categoryKindSnapshot`): cambiar el menú nunca reescribe
una cuenta pasada o un ticket ya impreso.

### Artículo IV — Un pedido abierto por sesión de cliente
Un cliente que envía su carrito **no puede iniciar otro menú** hasta que cancela o
paga. Regla materializada con **índice único parcial** (`sessionId` + `status =
'EN_CAJA'/'PAGADO'`). El pedido del cliente tiene **TTL por defecto de 30 minutos**
(configurable por tenant 15–90): vencido, **anulado en el servidor**; la pantalla del
cliente solo informa.

### Artículo V — Suscripción mitiga el acceso, no borra datos
`subscriptionExpiresAt` por tenant. **T-15 días, T-7 días y T-0** se registran
notificaciones (in-app + correo de ejecución diaria vía cron). Al vencer se **corta el
acceso** (status `VENCIDA`), pero **los datos se conservan íntegros** para reactivación.
El corte y los avisos quedan en `AuditLog`.

### Artículo VI — Caja es fuente de cobro; cocina y cliente solo informan
Solo el Cajero/Gerente puede cobrar, modificar o anular. La pantalla del cliente y la
comanda de cocina son **solo lectura** derivada del estado del pedido. Comandas se
emiten **separadas por categoría** (Platos / Bebidas / Postres) y solo con ítems
pendientes.

### Artículo VII — Mobile-first, siempre
La app del cliente y la de caja están diseñadas **primero para el teléfono**, con
breakpoints probados para `380 / 768 / 1280px`+. Targets táctiles ≥ 44px, contraste
**WCAG 2.1 AA**, sin dependencia de librerías UI pesadas.

### Artículo VIII — Simple antes que genial
MVP sin WebSockets (polling ligero / SSE), sin microservicios, sin Redis salvo
necesidad real. Un solo despliegue Next.js con App Router sirve las 4 experiencias
(superadmin / gerente / caja / cliente QR). Se optimiza por **costo**: hosting
gratuito viable, QR generado en servidor con librería local, sin servicios de pago
para features del núcleo.

### Artículo IX — Rendimiento observable
Páginas clave: TTI ≤ 3s en 3G rápido, polling/actualización de caja ≤ 5s, p95 de API
de cobro ≤ 500ms. La pantalla móvil del cliente pesa < 150KB de JS de primera carga.

### Artículo X — Seguridad y privacidad
Contraseñas bcrypt, sesiones httpOnly firmadas, tokens/secretos de APIs de pago
**cifrados en reposo**, nunca al cliente. El cliente se identifica con cookie `HttpOnly` firmada (session + mesa), sin registro
obligatorio. Datos personales mínimos: solo teléfono (opcional alias).

### Artículo XI — Auditoría trazable
Todo evento sensible (cobro, anulación, edición de menú, corte de suscripción,
cambio de credenciales API) queda en `AuditLog` con actor, tenant, antes/después.

### Artículo XII — Español primero, i18n listo
Cadenas en módulos de i18n (`es` default). Formatos de moneda y fecha por locale del
tenant. Preparado para `en`/`pt` sin reescritura.

---

## 3. Restricciones Técnicas (Sancionadas)

| Área | Elección | Prohibido hasta enmienda |
|---|---|---|
| Framework | Next.js 15 (App Router) + TypeScript strict | Multirepo, backends separados para MVP |
| BD / ORM | PostgreSQL 16 + Prisma | MongoDB, SQL sin migrations versionadas |
| UI | Tailwind CSS + componentes propios ligeros | Bootstrap/jQuery, librerías > 80KB gzip |
| Estado del cliente | Zustand (carrito cliente) |Redux en el MVP |
| Auth | Auth.js v5 (credenciales, roles) | Auth casera con JWT manual |
| Validación | Zod | — |
| Tiempo real | Polling 5s (v1) → SSE (v1.1) | WebSockets pagados |
| QR | `qrcode` (SVG local, servidor) | Servicios externos de QR |
| Pagos | Adaptador: `Efectivo` (v1) y **QR por imagen estática** (v1) → API QR (Mercado Pago / pagina web local / Otro proveedor) vía `PaymentProvider` config por tenant | Hardcode de gateway |
| Archivos | Guardado local (v1) / Storage con URL firmada (v1.1) | Cargas de cualquier tamaño sin límite |
| Despliegue | Vercel (o Docker Compose) + Neon/Supabase Postgres | Servicios que exijan plan pago para el MVP |
| Testing | Vitest (módulos puros: `money.ts`, state machine, cálculo de cambio) + Playwright (flujo QR→caja→cobro) | Shipping sin tests de lógica de dinero |

---

## 4. Modelo de Dominio (contrato mínimo inmutable)

Tenant · User · Category · Product · Table(+QrCode) · ClientSession · Order ·
OrderItem · Payment · PaymentProvider · StockMovement · SubscriptionEvent ·
AuditLog. Las extensiones (propinas, split, modificadores, multi-sede) **añaden**
modelos; nunca violan las reglas de **snapshot de precio (Art. III)** ni
**open-order-per-session (Art. IV)**. **El schema completo se define desde el día 1**
(modelado long-range) aunque el MVP toque solo parte, para evitar re-migraciones.

---

## 5. Reglas de Negocio Inmutables (extraídas del documento fundacional)

1. **R1:** El superadmin administra N restaurantes; cada restaurante se personaliza
   (nombre, logo, color, moneda, TTL de pedido, días de aviso) según su gerente.
2. **R2:** Cada restaurante registra y usa **varios proveedores de pago por QR**
   (adaptadores con credenciales propias, activables/desactivables y con prioridad).
3. **R3:** Roles por restaurante: **Gerente** (dashboard de todo el movimiento,
   crear categorías, productos con foto/precio/stock, crear cajeros), **Cajero**
   (recibe pedidos a la cola de caja, modifica/carrito, cobra, imprime), **Cliente**
   (opcional: pide desde su celular escaneando el QR de la mesa).
4. **R4:** El QR de mesa codifica **restaurante + número de mesa**; el cliente envía
   alias (cómo le llama caja) y **celular** para que caja lo identifique y evitar
   pedidos fantasma.
5. **R5:** Un cliente **no puede hacer un nuevo pedido** mientras su pedido no esté
   pagado o anulado (Art. IV).
6. **R6:** El pedido vence a los **30 min** (configurable): si no se apersona a caja,
   se **anula automáticamente** y se libera la sesión.
7. **R7:** Al cobrar se emite **ticket del cliente** (detalle total) y **comandas de
   cocina separadas por categoría: comida, bebida, postre** — solo con ítems que aún
   no se han mandado a cocina.
8. **R8:** Reportes del gerente: ventas por día/rango, **productos más vendidos**,
   **productos con stock agotado/bajo** (lista roja + alimentación de la alerta en el
   menú del cliente), ventas por categoría y por método de pago.
9. **R9:** La suscripción se contractúa por **meses o años**; en el dashboard global
   se ve qué restaurantes están activos y cuándo **vence cada uno**;
   **notificación automática 15 días antes**; al vencer, **acceso cortado** con
   pantalla de pago (no borrado).
10. **R10:** El descuento/aplicación de stock es **transaccional con la venta**: no
    se vende por encima del stock si `trackStock` está activo.

---

## 6. Criterios de Calidad (Definition of Done de cada story)

- [ ] Tests de los módulos puros afectados verdes (`money.ts`, state machine, TTL).
- [ ] Responsive verificado (móvil/tablet/PC).
- [ ] A11y AA: labels, focus, contraste, teclado en formularios de cobro/edición.
- [ ] Snapshot de precio respetado en salida a cocina/ticket tras cambios de menú.
- [ ] i18n items: sin textos mágicos sin traducir.
- [ ] Audits vistos: Idempotencia del cobro validada con doble llamada.
- [ ] `npm run build` + lint sin error; migración aplicada sin drift.

---

## 7. Gobernancia

| Acción | Requisito |
|---|---|
| Cambiar Principios Art. I–XII | Enmienda + revisión + versión *minor* |
| Añadir modelo de dominio | PR con migración + nota de compat. backward, y sin tocar inmutables (III, IV) |
| Cambiar una regla de negocio (R1–R10) | *Ratificación* (discusión + versión *major* del doc) |
| Añadir proveedor de pago | Solo si se escribe tras el **adaptador** existente y cifrando credenciales |

**Versión del documento:** `1.0.0` · Enmiendas en `SDD/AMENDMENTS.md`.
