# P00 — PROMPT: Crear la Constitución del Proyecto (Paso 1 del método SDD / Spec-Driven Development)

> **Cómo usarlo:** Copia TODO el contenido de este archivo (desde "PROMPT" para abajo) y pégalo
> en tu agente SDD (GitHub Spec Kit `speckit.constitution`, Kiro, o Claude/Codex con SDD).
> Este prompt contiene TODO el contexto del negocio, los requisitos del documento Word fundacional
> y los hallazgos del benchmark. No necesitas adjuntar nada más.

---

## PROMPT

### ROL

Actúa como **Arquitecto de Software y Especialista en Spec-Driven Development (SDD)** con
más de 10 años de experiencia construyendo sistemas de punto de venta (POS) y plataformas
SaaS multi-tenant para el sector gastronómico. Tu tarea es producir la **CONSTITUCIÓN DEL
PROYECTO** (`/constitution`) como **primer artefacto vinculante** del desarrollo: el
documento de gobierno que define principios inmutables, restricciones técnicas sancionadas,
reglas de negocio no negociables, quality gates y procesos de enmienda.

### CONTEXTO DEL NEGOCIO (fuente: documento fundacional del cliente)

Somos una **empresa de software** contratada para construir un sistema web que administre
**múltiples restaurantes** en una sola plataforma (SaaS multi-tenant). Los requisitos
fundacionales son:

1. **Multi-restaurante (multi-tenant).** El sistema administra N restaurantes; cada
   restaurante es **personalizable según su gerente** (nombre, logo, colores, moneda,
   parámetros operativos propios).
2. **Suscripciones por contrato.** Cada restaurante usa la aplicación **por tiempo
   limitado: meses o años según contrato suscrito**. Se requiere un **dashboard global**
   donde el operador vea qué restaurantes están usando el sistema y **cuál es su fecha
   de vencimiento**.
3. **Corte automático + notificación a 15 días.** Cuando una suscripción vence, el
   acceso del restaurante **se corta**, pero la vencidez debe **notificarse 15 días
   antes** al restaurante.
4. **Proveedores de pago por QR (APIs).** Cada restaurante puede tener **diferentes
   proveedores de pago por QR** y necesitamos un **administrador de APIs por
   restaurante**: credenciales por proveedor, activables/desactivables, con prioridad.
5. **Roles por restaurante:**
   - **Gerente:** dashboard con **todo el movimiento del restaurante a su cargo**;
     puede **crear categorías**, **crear productos** (con **foto, precio y stock**
     incrementable) y **crear cajeros**.
   - **Cajero:** se encarga de **asignar al carrito de compras y proceder al cobro**;
     una vez realizado el cobro se emite el **ticket de la compra**, con tickets
     separados por **comida, bebida y postres** (comandas de cocina por categoría).
   - **Cliente (opcional):** realiza su pedido **desde su celular mediante un QR** que
     le muestra el menú digital; la selección **va a la caja**; el cajero ve lo que
     seleccionó y procede al cobro. El cliente **no puede enviar otro menú** mientras
     no realice la **cancelación** correspondiente, y tiene un **tiempo límite de 30
     minutos** para apersonarse a caja; pasado ese tiempo, **el pedido se anula**.
     El **QR contiene el número de mesa** y se le solicita el **número de celular del
     cliente** para un **control más estricto** y evitar pedidos fantasma o repetidos.
6. **Interfaces de referencia validadas por el cliente (mockups YA aprobados):**
   - Menú móvil del cliente con encabezado del restaurante, chips de categoría
     (Todo/Platos/Bebidas/Postres), tarjetas de producto con foto, descripción corta,
     precio y stepper `−/+` o botón `+ Agregar`; barra inferior fija *“Ver pedido · N
     platos — Bs TOTAL”*; bottom-sheet *“Tu pedido”* con líneas editables y botón
     *“Enviar pedido a caja”* con nota de tiempo de espera en caja.
   - Tras enviar: **código de pedido de 5 caracteres** (p. ej. `VK3MD`) idéntico para
     el cliente y para caja; pantalla del cliente muestra **código grande, alias,
     total a cancelar, expire con cuenta atrás, hora de envío, celular y detalle**, y
     se auto-actualiza cada pocos segundos.
   - Pantalla de **caja**: tema oscuro; buscador “por celular, alias o código”; chips
     de filtro (En caja / Pagados / Anulados / Todos); tarjetas de pedido con código,
     alias, celular, countdown, breakdown de ítems, acciones **Modificar / Eliminar /
     Cobrar**.
   - Modal de **cobro**: resumen de la cuenta desglosado, confirmación del cliente,
     **método de pago Efectivo/QR**, **servicio En local/Para llevar**, monto entregado
     con atajos (monto exacto / denominaciones), **cambio (vuelto) calculado** en vivo,
     botón *Conforme y pagado — dar Bs X de cambio*, nota “se desplegarán dos comandas:
     cocina y barra”.
   - **Comanda de cocina imprimible 80mm**: encabezado del restaurante (tel, dir), código
     de pedido, cliente/alias/celular, comida/bebida/postre separados, “SERVIR EN LOCAL”,
     línea `tomó: QR del cliente`, espacio de firma del cocinero.
7. **Cultura/mercado:** moneda base **Boliviano (BOB, `Bs`)** configurable; español
   primero; restaurantes pequeños y medianos; cada restaurante contrata (paga) una
   suscripción al operador del SaaS.

### BENCHMARK (hallazgos de investigación de mercado 2026 — úsalos para ampliar la visión)

Competidores directos e indirectos evaluados: **Toast POS, Lightspeed Restaurant,
Square for Restaurants, Loyverse, Clover, TouchBistro, SpotOn, Odoo POS**, además de
SaaS multi-tenant de menú QR Next.js/Postgres (Qrder, Sofra, Smooth, Centyso, etc.).
Insights que LA CONSTITUCIÓN debe incorporar como principios:

- **Snapshot de precio al momento del pedido** (el menú cambia; la cuenta no).
- **“Un tab abierto por mesa/sesión”** materializado con índice único parcial en BD.
- **Pagos idempotentes** con clave de idempotencia por gateway.
- **Dinero siempre en enteros** (unidad menor), sin floats.
- **SSE/polling en vez de WebSockets pagados** para tiempo real en MVP.
- **Multi-tenancy con aislamiento doble** (capa de servicio + RLS opcional fase 2).
- **Máquina de estados declarada** para el ciclo de vida del pedido.
- **KDS (pantalla de cocina)** como valor probado en el rubro → fase 2.
- **Modificadores/extras, split de cuenta, propinas, lealtad** → backlog fase 2/3.
- **Offline-tolerant POS** (Loyverse lo valoriza) → fase 3 (No MVP).

### STACK Y RESTRICCIONES SANCIONADAS (vinculantes en la constitución)

- Next.js 15 (App Router) + TypeScript strict · **PostgreSQL 16** + **Prisma** ·
- Tailwind CSS + componentes propios · Zustand · Zod · Auth.js v5 (roles) ·
- `qrcode` (SVG local) · Vitest + Playwright · Deploy económico: **Vercel + Neon/Supabase**
   o Docker Compose (VPS-friendly). Un solo despliegue Next.js sirve las **4
  superficies**: superadmin, gerente, caja, cliente QR (`/m/[tenant]/[mesa]`).

### TAREA EXACTA

Genera el archivo `SDD/01-CONSTITUCION.md` con exactamente estas secciones:

1. **Cabecera de ratificación** (versión semver, fecha, lugar del proceso).
2. **Nombre, Visión y Usuario objetivo** (incluye el *North Star*).
3. **Principios Inmutables** (Romanos I–XIII). Debe incluir al menos:
   I. Multi-tenancy primero; II. El servidor manda (Zod + máquina de estados
   declarada); III. Dinero en enteros + snapshot de precio; IV. Un pedido abierto
   por sesión + TTL 30 min anulable en servidor; V. Suscripción: notificación a
   T-15/T-7/T-0 y corte al vencer sin borrar datos; VI. Caja única fuente de
   cobro, comandas separadas por comida/bebida/postre; VII. Mobile-first
   (380/768/1280px, WCAG AA); VIII. Simple antes que genial (costo/*burn-rate*
   mínimo); IX. Rendimiento observable con metas concretas; X. Seguridad
   (bcrypt, httpOnly, secretos de APIs de pago cifrados); XI. Auditoría trazable
   de eventos sensibles; XII. Español primero + i18n listo; XIII. Modelado
   long-range del schema desde el día 1.
4. **Restricciones Técnicas** en tabla (Área | Elección | Prohibido hasta enmienda).
5. **Modelo de Dominio mínimo:** lista de entidades y sus invariantes clave.
6. **Reglas de Negocio Inmutables R1–R10** (transcribe/normaliza el punto
   “CONTEXTO DEL NEGOCIO” arriba: multi-restaurante, admin de APIs QR,
   suscripción con vencimiento + 15 días, roles, carrito caja, TTL 30,
    código de pedido de 5 caracteres, comandas separadas por categoría, stock
    transaccional, reporte top-productos y agotados).
7. **Criterios de Calidad / Definition of Done** por story.
8. **Gobernancia:** cómo se añade un modelo, cómo se enmienda un principio,
   semver del documento.
9. **Registro de decisiones (ADR-lite)** mínimo 6: moneda entera; índice parcial
   pedido-sesión; adaptador de pagos; polling vs WS; storage de imágenes;
   tenancy por auth + slug QR.

### REGLAS DE REDACCIÓN (como especialista SDD)

- Escribe en **español**, con lenguaje imperativo y verificable (DEBE/NO DEBE).
- Nada de ambigüedad tipo “debería ser rápido”: si es una meta, cuantifícala.
- Cada principio inmutable debe poder **bloquear (rechazar) un PR** concreto.
- Total: 120–220 líneas. Sin relleno, sin florituras genéricas.

### FORMATO DE SALIDA

- Markdown puro, listo para guardarse como `SDD/01-CONSTITUCION.md`.
- Tras terminar, imprime el checklist **“Constitución verificada”** afirmando que
  cada requisito (1–6 del contexto) tiene su correspondiente principio/regla, y que
  los insights del benchmark que aplican al MVP quedaron reflejados.

---
