// src/lib/domain.ts — constantes de dominio (SQLite no soporta enums)
export const ROLES = ["SUPERADMIN", "GERENTE", "CAJERO"] as const;
export const ORDEN_STATUS = { EN_CAJA: "EN_CAJA", PAGADO: "PAGADO", ANULADO: "ANULADO", EXPIRADO: "EXPIRADO" } as const;
export const KINDS = ["PLATO", "BEBIDA", "POSTRE", "OTRO"] as const;
export type OrderStatus = (typeof ORDEN_STATUS)[keyof typeof ORDEN_STATUS];
export type Kind = (typeof KINDS)[number];

export const SUBS = { ACTIVA: "ACTIVA", POR_VENCER: "POR_VENCER", VENCIDA: "VENCIDA" } as const;
export const STORE_REASON = { VENTA: "VENTA", INGRESO: "INGRESO", MERMA: "MERMA", DEVOLUCION: "DEVOLUCION" } as const;

export const EMOJIS = ["🍽", "🍛", "🥘", "🍲", "🍖", "🐟", "🥗", "🥤", "🍹", "☕", "🍮", "🥮", "🍰", "🧁", "🥟"] as const;

export function subBadge(status: string, expiresAt: Date): { label: string; days: number; tone: "moss" | "gold" | "berry" } {
  const days = Math.ceil((expiresAt.getTime() - Date.now()) / 86400000);
  if (days < 0) return { label: "VENCIDA", days, tone: "berry" };
  if (days <= 15) return { label: `POR VENCER · ${days}d`, days, tone: "gold" };
  return { label: "ACTIVA", days, tone: "moss" };
}
