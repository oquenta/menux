import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { redirect } from "next/navigation";
import { fmt } from "@/lib/money";
import { crearCategoria, crearProducto, ingresoStock, toggleProducto, eliminarCategoria, actualizarFotoProducto } from "./actions";

export const dynamic = "force-dynamic";

export default async function MenuPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = await requireUser(["GERENTE"]);
  if (!s) redirect("/login");
  const tenant = await db.tenant.findUnique({ where: { slug } });
  const cats = await db.category.findMany({ where: { tenantId: tenant!.id }, orderBy: { sortOrder: "asc" }, include: { products: { orderBy: { name: "asc" } } } });

  return (
    <div>
      <h1 className="text-2xl font-extrabold">Menú</h1>
      <p className="text-muted">Categorías (comida · bebida · postre) y productos con foto, precio y stock (R1/R8)</p>

      <div className="mt-6 grid gap-5 xl:grid-cols-3">
        {/* Nueva categoría */}
        <form action={crearCategoria} className="card h-fit p-5">
          <h2 className="font-extrabold">+ Nueva categoría</h2>
          <label className="label mt-3">Nombre</label>
          <input name="name" required placeholder="Bebidas" className="input" />
          <label className="label mt-3">Tipo (define comandas R7)</label>
          <select name="kind" className="input" defaultValue="PLATO">
            <option value="PLATO">Comida (plato)</option>
            <option value="BEBIDA">Bebida</option>
            <option value="POSTRE">Postre</option>
            <option value="OTRO">Otro</option>
          </select>
          <button className="btn-primary mt-4 w-full">Crear categoría</button>
        </form>

        {/* Nuevo producto */}
        <form action={crearProducto} encType="multipart/form-data" className="card p-5 xl:col-span-2">
          <h2 className="font-extrabold">+ Nuevo producto</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label mt-3">Nombre</label>
              <input name="name" required className="input" placeholder="Sopa de Maní" />
              <label className="label mt-3">Categoría</label>
              <select name="categoryId" className="input" required>
                {cats.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.kind}</option>)}
              </select>
              <label className="label mt-3">Precio (Bs)</label>
              <input name="price" required inputMode="decimal" className="input" placeholder="22.00" />
            </div>
            <div>
              <label className="label mt-3">Ícono</label>
              <select name="emoji" className="input">
                {["🍛", "🥘", "🍲", "🍖", "🥗", "🐟", "🥤", "🍹", "☕", "🍮", "🥮", "🍰", "🧁", "🥟"].map((e) => <option key={e}>{e}</option>)}
              </select>
              <label className="label mt-3">Stock inicial</label>
              <input name="stock" type="number" min={0} defaultValue={10} className="input" />
              <label className="mt-3 inline-flex items-center gap-2 text-sm">
                <input type="checkbox" name="trackStock" defaultChecked className="h-4 w-4 accent-[#7C2D12]" /> Controlar stock
              </label>
            </div>
          </div>
          <label className="label mt-3">Descripción corta</label>
          <input name="description" className="input" placeholder="Ingredientes principales…" />
          <label className="label mt-3">Foto del plato/bebida/postre</label>
          <input name="photo" type="file" accept="image/*" className="input" />
          <p className="mt-1 text-xs text-muted">JPG, PNG o WebP. Si no subes imagen, se usará el ícono.</p>
          <button className="btn-primary mt-4">Publicar producto</button>
        </form>
      </div>

      {/* Listado por categoría */}
      <div className="mt-8 space-y-6">
        {cats.map((c) => (
          <div key={c.id} className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-line bg-paper/60 px-5 py-3">
              <div className="font-extrabold">
                {c.name} <span className="badge-line ml-2">{c.kind}</span>
              </div>
              <form action={eliminarCategoria}><input type="hidden" name="categoryId" value={c.id} /><button className="btn-danger !py-1 !px-2 text-xs" title="Solo si está vacía">Eliminar</button></form>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3">
              {c.products.map((p) => (
                <div key={p.id} className="border-b border-line px-5 py-4 last:border-0">
                  <div className="flex items-center gap-3">
                    {p.photoUrl ? (
                      <img src={p.photoUrl} alt={p.name} className="h-12 w-12 rounded-xl object-cover bg-paper" />
                    ) : (
                      <div className="grid h-12 w-12 place-items-center rounded-xl bg-paper text-2xl">{p.emoji}</div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className={`truncate font-bold ${p.active ? "" : "line-through opacity-50"}`}>{p.name}</div>
                      <div className="text-xs text-muted">{fmt(p.priceCents)} {p.trackStock && <>· stock <b>{p.stock}</b>{p.stock === 0 && <span className="ml-1 text-berry font-bold">(agotado)</span>}</>}</div>
                      {p.trackStock && (
                        <form action={ingresoStock} className="mt-1.5 flex gap-1">
                          <input type="hidden" name="productId" value={p.id} />
                          <input name="qty" type="number" min={1} placeholder="+N" className="input !w-16 !px-2 !py-1 text-xs" />
                          <button className="btn-ghost !py-1 !px-2 text-xs">Ingresar</button>
                        </form>
                      )}
                    </div>
                    <form action={toggleProducto}><input type="hidden" name="productId" value={p.id} /><button className="text-xs text-muted hover:text-terra">{p.active ? "Ocultar" : "Activar"}</button></form>
                  </div>
                  <form action={actualizarFotoProducto} encType="multipart/form-data" className="mt-2 flex flex-wrap items-center gap-2">
                    <input type="hidden" name="productId" value={p.id} />
                    <input name="photo" type="file" accept="image/*" className="input !py-1 !px-2 text-xs flex-1 min-w-0" />
                    <button className="btn-ghost !py-1 !px-2 text-xs whitespace-nowrap">Cambiar foto</button>
                  </form>
                </div>
              ))}
              {c.products.length === 0 && <div className="p-5 text-sm text-muted">Sin productos todavía.</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
