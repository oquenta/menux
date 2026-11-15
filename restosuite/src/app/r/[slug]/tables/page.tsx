import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { redirect } from "next/navigation";
import QRCode from "qrcode";

export const dynamic = "force-dynamic";

export default async function TablesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = await requireUser(["GERENTE"]);
  if (!s) redirect("/login");
  const tenant = await db.tenant.findUnique({ where: { slug }, include: { tables: { orderBy: { number: "asc" } } } });

  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const withQr = await Promise.all(
    (tenant?.tables ?? []).map(async (t) => ({
      ...t,
      url: `${base}/m/${slug}/${t.number}`,
      qrDataUrl: await QRCode.toDataURL(`${base}/m/${slug}/${t.number}`, { margin: 1, width: 240, color: { dark: "#2A2118", light: "#FFFFFF" } }),
    }))
  );

  return (
    <div>
      <h1 className="text-2xl font-extrabold">Mesas y códigos QR</h1>
      <p className="text-muted">Cada QR codifica el restaurante + número de mesa (R4). Imprímelos y pégalos en cada mesa.</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {withQr.map((t) => (
          <div key={t.id} className="card p-4 text-center">
            <div className="text-sm font-extrabold">MESA {t.number}</div>
            <div className="text-xs text-muted">{t.seats} asientos</div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={t.qrDataUrl} alt={`QR mesa ${t.number}`} className="mx-auto mt-3 w-32 rounded-lg border border-line" />
            <div className="mt-2 break-all text-[10px] text-muted">{t.url}</div>
            <button className="btn-ghost mt-2 w-full !py-1 text-xs" onClick={undefined}>🖨 Imprimir (Ctrl+P)</button>
          </div>
        ))}
      </div>
    </div>
  );
}
