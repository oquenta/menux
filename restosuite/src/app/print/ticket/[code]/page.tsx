import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { fmt } from "@/lib/money";
import PrintAutoPrint from "@/components/PrintAutoPrint";

export const dynamic = "force-dynamic";

export default async function TicketPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const o = await db.order.findFirst({ where: { code, createdAt: { gte: new Date(Date.now() - 86400000) } }, include: { items: true, tenant: true } });
  if (!o) notFound();

  return (
    <div className="min-h-screen bg-paper py-6">
      <PrintAutoPrint label="Ticket de venta" code={o.code} />
      <div className="ticket mx-auto bg-white px-4 py-5 shadow border border-line">
        <div className="text-center font-bold">LA PAILA — PICANTERÍA CRIOLLA</div>
        <div className="mt-0.5 text-center text-[10px] leading-tight">
          Telf: 23456789 · Av. Principal #1259<br />Zona Central, Cochabamba
        </div>
        <div className="mt-3 text-center text-[10px]">─────────────</div>
        <div className="text-center text-[11px] font-bold">TICKET DE VENTA</div>
        <div className="mt-1 text-center text-[10px]">PEDIDO CÓDIGO: <b className="text-sm">{o.code}</b></div>
        <div className="text-center text-[10px]">
          Fecha: {o.createdAt.toLocaleString("es-BO", { dateStyle: "short", timeStyle: "short" })}
        </div>
        <div className="text-center text-[10px]">
          Cliente: {(o.aliasSnapshot ?? "—").toUpperCase()} · {o.phoneSnapshot ?? "s/tel"} {o.tableNumber != null ? `· MESA ${o.tableNumber}` : ""}
        </div>
        <div className="text-center text-[10px]">** {o.serviceType === "PARA_LLEVAR" ? "PARA LLEVAR" : "SERVIR EN LOCAL"} **</div>
        <div className="mt-2 text-center text-[10px]">─────────────</div>
        <div className="mt-1 space-y-0.5 text-[10px]">
          {o.items.map((i) => (
            <div key={i.id} className="flex justify-between">
              <span>{i.qty}x {i.nameSnapshot.slice(0, 26)}</span><span>{fmt(i.qty * i.unitPriceCents).replace("Bs ", "")}</span>
            </div>
          ))}
          <div className="flex justify-between border-t border-dashed border-black/40 pt-1 font-bold">
            <span>TOTAL</span><span>{fmt(o.totalCents)}</span>
          </div>
          {o.method && (
            <div className="pt-1">
              <div className="flex justify-between"><span>Forma pago: {o.method}</span></div>
              {o.changeCents != null && <div className="flex justify-between font-bold"><span>CAMBIO:</span><span>{fmt(o.changeCents)}</span></div>}
            </div>
          )}
        </div>
        <div className="mt-3 text-center text-[10px]">─────────────</div>
        <div className="mt-2 text-center text-[10px]">Atendido por caja RestoSuite<span /><br />tomó: {o.source === "CLIENTE_QR" ? `QR del cliente ${o.code}` : "carga manual del cajero"}</div>
        <div className="mt-4 text-center text-[10px] font-bold">&quot;¡Gracias por su preferencia!&quot;</div>
        <div className="mt-3 text-center text-[9px] text-black/50">Servido con RestoSuite · ticket {o.code}</div>
      </div>
    </div>
  );
}
