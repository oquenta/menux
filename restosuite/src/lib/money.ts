// src/lib/money.ts — Dinero SIEMPRE en centavos enteros (Art. III)
export function fmt(cents: number, currency = "BOB"): string {
  const s = (cents / 100).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (currency === "BOB") return `Bs ${s}`;
  return `${currency} ${s}`;
}
export function add(a: number, b: number): number { return Math.round(a + b); }
export function mul(qty: number, unit: number): number { return Math.round(qty * unit); }
export function change(received: number, total: number): number {
  if (received <= 0) return 0;
  return Math.max(0, Math.round(received - total));
}
export function parseBs(input: string): number {
  const v = parseFloat(input.replace(",", ".").replace(/[^0-9.]/g, ""));
  if (!v || v < 0) return 0;
  return Math.round(v * 100);
}
export function parseToCents(input: string): number { return parseBs(input); }
