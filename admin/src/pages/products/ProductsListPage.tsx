import { Link, useNavigate } from "react-router-dom";
import { Plus, ImageOff } from "lucide-react";
import { useAdminProducts } from "@/hooks/useAdminProducts";
import { cn } from "@/lib/cn";

export function ProductsListPage() {
  const { data: products = [], isLoading } = useAdminProducts();
  const navigate = useNavigate();

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Products</h1>
          <p className="mt-1 text-sm text-slate-500">
            Full catalogue — {products.length} product
            {products.length === 1 ? "" : "s"}.
          </p>
        </div>
        <Link
          to="/products/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" /> New product
        </Link>
      </div>

      <div className="overflow-hidden rounded-card border border-slate-200 bg-white">
        {isLoading && (
          <div className="p-8 text-center text-sm text-slate-500">Loading…</div>
        )}
        {!isLoading && products.length === 0 && (
          <div className="p-8 text-center text-sm text-slate-500">
            No products yet.{" "}
            <Link to="/products/new" className="text-brand-500 hover:underline">
              Add your first product
            </Link>
            .
          </div>
        )}
        {!isLoading && products.length > 0 && (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Product</th>
                <th className="px-4 py-2 font-medium">Category</th>
                <th className="px-4 py-2 font-medium text-right">Price</th>
                <th className="px-4 py-2 font-medium">Type</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => navigate(`/products/${p.id}`)}
                  className="cursor-pointer hover:bg-slate-50"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {p.images[0] ? (
                        <img
                          src={p.images[0]}
                          alt=""
                          className="h-10 w-10 shrink-0 rounded-md object-cover"
                        />
                      ) : (
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-400">
                          <ImageOff className="h-4 w-4" />
                        </span>
                      )}
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-900">
                          {p.name}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          /{p.slug}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {p.category.name}
                  </td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums">
                    ₹{Number(p.basePrice).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {p.productType === "CONFIGURABLE"
                      ? "Configurable"
                      : "Variants"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadges
                      isActive={p.isActive}
                      isAvailable={p.isAvailable}
                      isFeatured={p.isFeatured}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StatusBadges({
  isActive,
  isAvailable,
  isFeatured,
}: {
  isActive: boolean;
  isAvailable: boolean;
  isFeatured: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      <Chip
        active={isActive}
        label={isActive ? "Active" : "Draft"}
        tone={isActive ? "green" : "slate"}
      />
      <Chip
        active={isAvailable}
        label={isAvailable ? "In stock" : "Sold out"}
        tone={isAvailable ? "green" : "amber"}
      />
      {isFeatured && <Chip active label="Featured" tone="brand" />}
    </div>
  );
}

function Chip({
  active,
  label,
  tone,
}: {
  active: boolean;
  label: string;
  tone: "green" | "slate" | "amber" | "brand";
}) {
  const tones: Record<string, string> = {
    green: "bg-emerald-50 text-emerald-700",
    slate: "bg-slate-100 text-slate-600",
    amber: "bg-amber-50 text-amber-700",
    brand: "bg-brand-100 text-brand-700",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium",
        active ? tones[tone] : "bg-slate-100 text-slate-500",
      )}
    >
      {label}
    </span>
  );
}
