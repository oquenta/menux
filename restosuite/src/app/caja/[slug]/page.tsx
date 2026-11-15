import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { redirect, notFound } from "next/navigation";
import CajaClient from "./CajaClient";

export const dynamic = "force-dynamic";

export default async function CajaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = await requireUser(["CAJERO", "GERENTE"]);
  if (!s) redirect("/login");
  if (s.slug !== slug) notFound();
  const tenant = await db.tenant.findUnique({ where: { slug }, include: { products: { where: { active: true }, include: { category: true } }, tables: true, providers: true } });
  if (!tenant) notFound();
  if (tenant.subStatus === "VENCIDA") {
    return (
      <div className="grid min-h-screen place-items-center bg-night p-6">
        <div className="max-w-md rounded-2xl bg-nightcard p-8 text-center text-paper">
          <div className="text-5xl">🔒</div>
          <h1 className="mt-4 text-xl font-extrabold">Suscripción vencida</h1>
          <p className="mt-2 text-paper/70">Contacta al operador RestoSuite para renovar.</p>
        </div>
      </div>
    );
  }

  return (
    <CajaClient
      slug={slug}
      userName={s.name}
      displayName={s.displayName ?? s.name.slice(0, 2)}
      products={tenant.products.map((p) => ({
        id: p.id, name: p.name, emoji: p.emoji, priceCents: p.priceCents, stock: p.stock, trackStock: p.trackStock,
        kind: p.category.kind, category: p.category.name,
      }))}
      tables={tenant.tables.map((t) => ({ id: t.id, number: t.number }))}
      providers={tenant.providers.filter((p) => p.active).map((p) => ({ id: p.id, name: p.name }))}
      warned={tenant.subStatus === "POR_VENCER"}
    />
  );
}
