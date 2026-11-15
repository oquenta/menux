import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { fmt } from "@/lib/money";
import PrintAutoPrint from "@/components/PrintAutoPrint";

export const dynamic = "force-dynamic";

const META: Record<string, { title: string; signer: string }> = {
  PLATO: { title: "COMANDA DE COCINA", signer: "cocinero" },
  BEBIDA: { title: "COMANDA DE BARRA", signer: "barman" },
  POSTRE: { title: "COMANDA DE DULCES", signer: "repostería" },
};

export default async function ComandaPage({ params }: { params: Promise<{ code: string; kind: string }> }) {
  const { code, kind } = await params;
  const K = kind.toUpperCase();
  if (!Object.keys(META).includes(K)) notFound();
  const o = await db.order.findFirst({ where: { code, createdAt: { gte: new Date(Date.now() - 86400000) } }, include: { items: true, tenant: true } });
  if (!o) notFound();
  const items = o.items.filter((i) => i.kindSnapshot === K);
  if (items.length === 0) notFound();
  const subtotal = items.reduce((a, i) => a + i.qty * i.unitPriceCents, 0);
  const meta = META[K];

  // Marca ítems como enviados a cocina (evita comandas duplicadas al reimprimir de verdad)
  await db.orderItem.updateMany({ where: { id: { in: items.map((i) => i.id) }, sentToKitchen: false }, data: { sentToKitchen: true } });

  return (
    <div className="min-h-screen bg-paper py-6">
      <PrintAutoPrint label={`${META[K].title.toLowerCase()} — ${K}`} code={o.code} />
      <div className="ticket mx-auto bg-white px-4 py-5 shadow border border-line">
        <div className="text-center font-bold">{o.tenant.name.toUpperCase()}</div>
        <div className="mt-1 text-center text-[12px] font-bold">{meta.title}</div>
        <div className="mt-2 text-center text-[11px] font-extrabold text-[#7C2D12]">** {K === "PLATO" ? "PLATOS" : K === "BEBIDA" ? "BEBIDAS" : "POSTRES"} **</div>
        <div className="mt-2 text-center text-[10px]">{o.createdAt.toLocaleString("es-BO", { dateStyle: "short", timeStyle: "short" })}</div>
        <div className="mt-1 text-[10px]">CÓDIGO: <b>{o.code}</b> {o.tableNumber != null ? `(mesa ${o.tableNumber})` : "(para llevar)"}</div>
        <div className="text-[10px]">Cliente: {o.aliasSnapshot ?? "—"} · {o.phoneSnapshot ?? "s/tel"}</div>
        <div className="mt-2 text-center text-[10px]">** {o.serviceType === "PARA_LLEVAR" ? "PARA LLEVAR" : "SERVIR EN LOCAL"} **</div>
        <div className="mt-2 text-[10px]">─────────────</div>
        <div className="mt-1 space-y-1 text-[11px] font-bold">
          {items.map((i) => (
            <div key={i.id}>{i.qty} × {i.nameSnapshot}</div>
          ))}
        </div>
        <div className="mt-2 text-[10px]">─────────────</div>
        <div className="mt-1 text-[10px]">total {K.toLowerCase()}: {fmt(subtotal)}</div>
        <div className="text-[10px]">tomó: {o.source === "CLIENTE_QR" ? `QR del cliente (${o.code})` : "carga manual del cajero"}</div>
        <div className="mt-6 text-[10px]">______________</div>
        <div className="text-[10px]">{meta.signer}</div>
        <div className="mt-4 text-center text-[9px] font-bold">&quot;¡Gracias por su preferencia!&quot;</div>
      </div>
    </div>
  );
}
