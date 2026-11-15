# ESPECIFICACIÓN FUNCIONAL v1.0 — RestoSuite

> Deriva de la Constitución (`01-CONSTITUCION.md`). Cada historia cita su regla (R#) y artíus (Art. #).

## Épico A — Plataforma / Superadmin
- **A1. Autenticación por rol.** INICIO: email+contraseña. Criterios: redirige a `/admin`
  (SUPERADMIN), `/r/{tenant}/dashboard` (GERENTE), `/caja/{tenant}` (CAJERO). Sesión
  httpOnly; sin acceso cruzado entre tenants/roles.
- **A2. Gestión de restaurantes.** Crear/editar tenant: nombre, slug, logo, color primario,
  moneda, teléfono/dirección, `orderTtlMinutes` (15–90, default 30), `notifyDaysBefore`
  (default 15), plan, fecha de inicio y **vencimiento**. Criterios: slug único; validación
  Zod; vencimiento pasado ⇒ status `VENCIDA`.
- **A3. Tabla de vencimientos.** Columnas: restaurante/Plan/Inicio/Vence/Estado con badges
  ACTIVA (verde >15d), POR_VENCER (ámbar ≤15d, muestra “X días”), VENCIDA (roja).
  Filtros: todos/por vencer/vencidas. **Fuente: R9.**
- **A4. Notificaciones de vencimiento.** Job diario: T-15, T-7, T-0 crea `SubscriptionEvent`
  + banner in-app durante login del gerente + correo (si SMTP configurado). Idempotente por
  tipo/día. **Fuente: R9 / Art. V.**
- **A5. Corte al vencer.** Middleware: tenant con `expiresAt < today + 1s` → redirect a
  pantalla pública “suscripción vencida” con botón *Renovar* (mailto/usuario). Datos
  intactos; reactivación con un cambio de fecha. **Fuente: R9.**

## Épico B — Gerente
- **B1. Dashboard del movimiento.** KPIs: ventas hoy (Bs), pedidos, ticket promedio,
  pedidos anulados, stock bajo. Gráfico ventas 7 días. Listas: top 10 productos vendidos,
  productos agotados. **Fuente: R8/Gerente.**
- **B2. Categorías.** CRUD con `kind` (PLATO/BEBIDA/POSTRE/OTRO) + orden. Al menos
  esas 3 kinds obligatorias para mapear comandas. **Fuente: R7.**
- **B3. Productos.** CRUD: nombre, descripción corta, **foto** (upload local ≤2MB, se
  optimiza con sharp), **precio (Bs)**, **stock** con historial de movimientos (ingreso/
  ajuste/merma) e incrementable, `trackStock` on/off, active. Stock 0 ⇒ botón desactivado
  y etiqueta “Agotado” en el menú. **Fuente: R1/R8/R10.**
- **B4. Cajeros.** CRUD de usuarios rol CAJERO del tenant (nombre, usuario/alias mostrado
  en caja, contraseña). **Fuente: R3.**
- **B5. Mesas y QR.** CRUD de mesas (número asientos); genera QR (SVG/PNG imprimible)
  que codifica `/m/{slug}/{numero}`. Descarga individual + hoja de todos.
- **B6. Reportes.** Ventas por día/rango, por categoría, por método; top productos
  (unidades y Bs); stock agotado/bajo. Export CSV. **Fuente: R8.**
- **B7. Admin de APIs de pago.** CRUD de `PaymentProvider` del tenant: tipo
  (QR_ESTATICO / MERCADO_PAGO / QR_BANCO_GENERICO / OTRO), credenciales cifradas, activo,
  prioridad, imágenes de QR de cobro por menú de banco. Test de conexión. **Fuente: R2.**

## Épico C — Cajero
- **C0. Nuevo pedido manual (“+ nuevo”).** El cajero crea un pedido SIN QR:
  paso 1 datos del cliente (**alias + celular**, obligatorios, R4), selección de
  **mesa** (o para llevar), servicio EN_LOCAL/PARA_LLEVAR; paso 2 grid de
  productos tipo POS con búsqueda y filtros por categoría (agotados deshabilitados,
  R10); paso 3 elegir: **Guardar en cola** (queda EN_CAJA con TTL 30 min desde el
  envío, R6) o **Ir directo a cobrar** (saltar al modal C2). Se genera el código de
  5 caracteres y queda visible en la cola como cualquier pedido QR. No permite
  duplicar mesa con pedido abierto (Art. IV).
- **C1. Cola de pedidos.** Lista viva (polling 5s) con chips En caja/Pagados/Anulados/Todos;
  buscador por **celular, alias o código**; cada tarjeta: código 5-car, alias, celular,
  breakdown, countdown TTL, acciones Modificar/Anular/Cobrar. **Fuente: Caja mockup.**
- **C2. Cobro (modal).** Resumen desglosado; confirmación del cliente; método
  EFECTIVO (monto entregado con atajos de denominación y **cambio en vivo**) o QR
  (proveedor activo del tenant, imagen QR; v1 registra pago - adjunta referencia);
  servicio EN_LOCAL/PARA_LLEVAR. Botón “Conforme y pagado — dar Bs X”. Payment
  idempotente. **Fuente: R3/R7 + mockup.**
- **C3. Tickets y comandas.** Al cobrar: se abren/auto-disponibilizan
  **ticket del cliente** (cuenta completa en 80mm) y **comandas por categoría**
  (comida/bebida/postre) solo con ítems no aún mandados a cocina; en cada una
  “SERVIR EN LOCAL/PARA LLEVAR”, código, cliente, hora, línea `tomó: QR del cliente`.
  **Fuente: R7.**
- **C4. Modificar/Anular pedido.** El cajero puede editar cantidades en
  modal (recalcula total, aplica delta de stock transaccional) o anular con motivo
  (devuelve stock). Audit log obligatorio. **Fuente: mockup “Modificar/Eliminar”.**

## Épico D — Cliente QR (opcional, mobile)
- **D1. Menú por QR.** Escanear `QR de mesa` → menú del restaurante (sin login), con
  categorías, productos, agotados deshabilitados, steppers `−/+` siempre ≥ 44px táctil;
  carrito fijo abajo.
- **D2. Enviar pedido.** Bottom-sheet con líneas editables + total + formulario
  **alias (cómo llama caja) + celular** (validación). Botón “Enviar pedido a caja”.
- **D3. Confirmación del pedido.** Pantalla con **código grande 5-car**, alias, celular,
  total, TTL “Expira en mm:ss” con cuenta atrás, detalle y auto-refresh 5s. Estado
  sincronizado con caja (EN_CAJA → PAGADO → “¡Gracias!” o EXPIRADO → “El pedido fue
  anulado; escanea de nuevo”).
- **D4. Exclusión de pedidos.** Mientras exista pedido abierto/pagado de su sesión:
  nueva selección muestra aviso “Ya tienes un pedido en caja — código XXXXX”; solo caja
  puede liberar. **Fuente: R5/Art. IV.**
- **D5. Expiración 30 min.** Al llegar a 0: estado EXPIRADO en servidor, stock devuelto,
  pantalla del cliente informa e invalida la sesión. **Fuente: R6.**

## Épico E — Suscripción (negocio del operador)
- **E1. Cobros y plan.** Registro de pago de suscripción (manual v1: registra monto,
  días otorgados). Historia por tenant. (Fase 2: pasarela.)
- **E2. KPIs del operador.** Restaurantes activos, por vencer 15d, vencidos, MRR.

## Requisitos No Funcionales (resumen de la Constitución)
- Responsive 380/768/1280+; WCAG AA; es-BO default i18n extensible.
- Money entero en centavos; **sin floats en ninguna capa**.
- Snapshot de precio; pagos idempotentes; stock transaccional.
- P95 cobro ≤ 500ms; cola de caja refresco ≤ 5s; página móvil < 150KB JS gzip.
- Tests: unit (money/state/ttl) + e2e (QR→caja→cobro; doble cobro; TTL).
