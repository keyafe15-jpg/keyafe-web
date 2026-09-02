import { useEffect, useState } from "react";
import { Field, inputClass, submitClass } from "@/components/form/Field";
import { useAdminCategories } from "@/hooks/useAdminCategories";
import {
  useAdminCoupons,
  useEmailCoupon,
  useFreeDeliverySettings,
  useSetCouponActive,
  useUpdateFreeDelivery,
  useUpsertCoupon,
  type AdminCoupon,
  type CouponType,
} from "@/hooks/useAdminCoupons";
import { cn } from "@/lib/cn";

function toLocalInput(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function emptyForm() {
  const from = new Date();
  const until = new Date();
  until.setDate(until.getDate() + 14);
  return {
    code: "",
    type: "PERCENT" as CouponType,
    value: "50",
    minCartAmount: "",
    maxDiscount: "",
    applicableCategoryIds: [] as string[],
    perCustomerLimit: "1",
    totalUsageLimit: "",
    validFrom: toLocalInput(from.toISOString()),
    validUntil: toLocalInput(until.toISOString()),
    waivesDelivery: false,
    restrictedToPhone: "",
    note: "",
    showOnStorefront: false,
    headline: "",
    storefrontCopy: "",
    isActive: true,
  };
}

export function CouponsPage() {
  const { data: coupons = [], isLoading } = useAdminCoupons();
  const { data: categories = [] } = useAdminCategories();
  const upsert = useUpsertCoupon();
  const setActive = useSetCouponActive();
  const email = useEmailCoupon();
  const free = useFreeDeliverySettings();
  const saveFree = useUpdateFreeDelivery();

  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [emailTo, setEmailTo] = useState<Record<string, string>>({});

  const [fdFrom, setFdFrom] = useState("");
  const [fdUntil, setFdUntil] = useState("");
  const [fdMin, setFdMin] = useState("");

  useEffect(() => {
    if (!free.data) return;
    setFdFrom(toLocalInput(free.data.freeDeliveryFrom));
    setFdUntil(toLocalInput(free.data.freeDeliveryUntil));
    setFdMin(
      free.data.freeDeliveryMinCart != null
        ? String(free.data.freeDeliveryMinCart)
        : "",
    );
  }, [free.data]);

  const loadCoupon = (c: AdminCoupon) => {
    setEditing(c.code);
    setForm({
      code: c.code,
      type: c.type,
      value: String(Number(c.value)),
      minCartAmount: c.minCartAmount != null ? String(Number(c.minCartAmount)) : "",
      maxDiscount: c.maxDiscount != null ? String(Number(c.maxDiscount)) : "",
      applicableCategoryIds: c.applicableCategoryIds,
      perCustomerLimit:
        c.perCustomerLimit != null ? String(c.perCustomerLimit) : "",
      totalUsageLimit:
        c.totalUsageLimit != null ? String(c.totalUsageLimit) : "",
      validFrom: toLocalInput(c.validFrom),
      validUntil: toLocalInput(c.validUntil),
      waivesDelivery: c.waivesDelivery,
      restrictedToPhone: c.restrictedToPhone ?? "",
      note: c.note ?? "",
      showOnStorefront: c.showOnStorefront,
      headline: c.headline ?? "",
      storefrontCopy: c.storefrontCopy ?? "",
      isActive: c.isActive,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const saveCoupon = async () => {
    setFormError(null);
    try {
      await upsert.mutateAsync({
        code: form.code,
        type: form.type,
        value: Number(form.value),
        minCartAmount: form.minCartAmount ? Number(form.minCartAmount) : null,
        maxDiscount: form.maxDiscount ? Number(form.maxDiscount) : null,
        applicableCategoryIds: form.applicableCategoryIds,
        perCustomerLimit: form.perCustomerLimit
          ? Number(form.perCustomerLimit)
          : null,
        totalUsageLimit: form.totalUsageLimit
          ? Number(form.totalUsageLimit)
          : null,
        validFrom: new Date(form.validFrom).toISOString(),
        validUntil: new Date(form.validUntil).toISOString(),
        waivesDelivery: form.waivesDelivery,
        restrictedToPhone: form.restrictedToPhone || null,
        note: form.note || null,
        showOnStorefront: form.showOnStorefront,
        headline: form.headline || null,
        storefrontCopy: form.storefrontCopy || null,
        isActive: form.isActive,
      });
      setForm(emptyForm());
      setEditing(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Couldn’t save coupon");
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Coupons</h1>
        <p className="mt-1 text-sm text-slate-500">
          Discount codes for the storefront, plus a sitewide free-delivery window.
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">Free delivery</h2>
        <p className="mt-1 text-xs text-slate-500">
          No code needed. Storefront delivery is ₹0 while this window is on.
          Offline orders still pay the pincode fee.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Field label="From">
            <input
              type="datetime-local"
              className={inputClass}
              value={fdFrom}
              onChange={(e) => setFdFrom(e.target.value)}
            />
          </Field>
          <Field label="Until" hint="Clear until to turn off">
            <input
              type="datetime-local"
              className={inputClass}
              value={fdUntil}
              onChange={(e) => setFdUntil(e.target.value)}
            />
          </Field>
          <Field label="Min cart (₹)" hint="Empty = all orders">
            <input
              type="number"
              min={0}
              className={inputClass}
              value={fdMin}
              onChange={(e) => setFdMin(e.target.value)}
            />
          </Field>
        </div>
        <button
          type="button"
          className={cn(submitClass, "mt-4")}
          disabled={saveFree.isPending}
          onClick={() =>
            saveFree.mutate({
              freeDeliveryFrom: fdFrom ? new Date(fdFrom).toISOString() : null,
              freeDeliveryUntil: fdUntil
                ? new Date(fdUntil).toISOString()
                : null,
              freeDeliveryMinCart: fdMin ? Number(fdMin) : null,
            })
          }
        >
          {saveFree.isPending ? "Saving…" : "Save free delivery"}
        </button>
        {saveFree.isSuccess && (
          <span className="ml-3 text-xs text-emerald-700">Saved</span>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">
          {editing ? `Edit ${editing}` : "New coupon"}
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Code" required>
            <input
              className={cn(inputClass, "uppercase")}
              value={form.code}
              disabled={Boolean(editing)}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder="LAUNCH50"
            />
          </Field>
          <Field label="Type">
            <select
              className={inputClass}
              value={form.type}
              onChange={(e) =>
                setForm({ ...form, type: e.target.value as CouponType })
              }
            >
              <option value="PERCENT">Percent off</option>
              <option value="FLAT">Flat ₹ off</option>
            </select>
          </Field>
          <Field label={form.type === "PERCENT" ? "Percent" : "Amount (₹)"}>
            <input
              type="number"
              min={0}
              className={inputClass}
              value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })}
            />
          </Field>
          <Field label="Max discount ₹" hint="Caps a percent coupon">
            <input
              type="number"
              min={0}
              className={inputClass}
              value={form.maxDiscount}
              onChange={(e) =>
                setForm({ ...form, maxDiscount: e.target.value })
              }
            />
          </Field>
          <Field label="Min cart ₹">
            <input
              type="number"
              min={0}
              className={inputClass}
              value={form.minCartAmount}
              onChange={(e) =>
                setForm({ ...form, minCartAmount: e.target.value })
              }
            />
          </Field>
          <Field label="Total uses" hint="e.g. 50 for launch">
            <input
              type="number"
              min={1}
              className={inputClass}
              value={form.totalUsageLimit}
              onChange={(e) =>
                setForm({ ...form, totalUsageLimit: e.target.value })
              }
            />
          </Field>
          <Field label="Per phone" hint="Usually 1">
            <input
              type="number"
              min={1}
              className={inputClass}
              value={form.perCustomerLimit}
              onChange={(e) =>
                setForm({ ...form, perCustomerLimit: e.target.value })
              }
            />
          </Field>
          <Field label="Valid from">
            <input
              type="datetime-local"
              className={inputClass}
              value={form.validFrom}
              onChange={(e) => setForm({ ...form, validFrom: e.target.value })}
            />
          </Field>
          <Field label="Valid until">
            <input
              type="datetime-local"
              className={inputClass}
              value={form.validUntil}
              onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
            />
          </Field>
          <Field label="Only this phone" hint="Complaint / gift code">
            <input
              className={inputClass}
              value={form.restrictedToPhone}
              onChange={(e) =>
                setForm({ ...form, restrictedToPhone: e.target.value })
              }
              placeholder="9330048665"
            />
          </Field>
          <Field label="Note">
            <input
              className={inputClass}
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
            />
          </Field>
          <Field
            label="Homepage headline"
            hint="e.g. 50% off for the first 50 orders"
            className="sm:col-span-2"
          >
            <input
              className={inputClass}
              value={form.headline}
              maxLength={80}
              onChange={(e) => setForm({ ...form, headline: e.target.value })}
              placeholder="Launch special — 50% off"
            />
          </Field>
          <Field
            label="Homepage writeup"
            hint="Shown under the headline. Mention first 50 customers, dates, etc."
            className="sm:col-span-2 lg:col-span-3"
          >
            <textarea
              className={inputClass}
              rows={2}
              maxLength={240}
              value={form.storefrontCopy}
              onChange={(e) =>
                setForm({ ...form, storefrontCopy: e.target.value })
              }
              placeholder="Use LAUNCH50 at checkout. First 50 storefront orders only — while it lasts."
            />
          </Field>
        </div>
        <Field label="Categories" hint="Empty = whole shop" className="mt-4">
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => {
              const on = form.applicableCategoryIds.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() =>
                    setForm({
                      ...form,
                      applicableCategoryIds: on
                        ? form.applicableCategoryIds.filter((id) => id !== c.id)
                        : [...form.applicableCategoryIds, c.id],
                    })
                  }
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs font-medium",
                    on
                      ? "border-brand-500 bg-brand-50 text-brand-700"
                      : "border-slate-200 text-slate-600",
                  )}
                >
                  {c.parentName ? `${c.parentName} / ${c.name}` : c.name}
                </button>
              );
            })}
          </div>
        </Field>
        <label className="mt-4 flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={form.showOnStorefront}
            onChange={(e) =>
              setForm({ ...form, showOnStorefront: e.target.checked })
            }
          />
          Show on homepage banner
        </label>
        <label className="mt-4 flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={form.waivesDelivery}
            onChange={(e) =>
              setForm({ ...form, waivesDelivery: e.target.checked })
            }
          />
          Also waive delivery
        </label>
        <label className="mt-2 flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
          />
          Active
        </label>
        {formError && (
          <p className="mt-3 text-sm text-red-700">{formError}</p>
        )}
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            className={submitClass}
            disabled={upsert.isPending}
            onClick={() => void saveCoupon()}
          >
            {upsert.isPending ? "Saving…" : editing ? "Update coupon" : "Create coupon"}
          </button>
          {editing && (
            <button
              type="button"
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm"
              onClick={() => {
                setEditing(null);
                setForm(emptyForm());
              }}
            >
              Cancel edit
            </button>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">All codes</h2>
        {isLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : coupons.length === 0 ? (
          <p className="text-sm text-slate-500">No coupons yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2">Code</th>
                  <th className="px-4 py-2">Offer</th>
                  <th className="px-4 py-2">Uses</th>
                  <th className="px-4 py-2">Window</th>
                  <th className="px-4 py-2">Email</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {coupons.map((c) => (
                  <tr key={c.code} className="border-b border-slate-50">
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className="font-mono font-semibold text-slate-900 hover:text-brand-600"
                        onClick={() => loadCoupon(c)}
                      >
                        {c.code}
                      </button>
                      {!c.isActive && (
                        <span className="ml-2 text-[10px] uppercase text-slate-400">
                          off
                        </span>
                      )}
                      {c.showOnStorefront && (
                        <span className="ml-2 text-[10px] text-brand-600">
                          homepage
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {c.type === "PERCENT"
                        ? `${Number(c.value)}%`
                        : `₹${Number(c.value)}`}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-600">
                      {c.usageCount}
                      {c.totalUsageLimit != null ? ` / ${c.totalUsageLimit}` : ""}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {new Date(c.validFrom).toLocaleDateString("en-IN")} –{" "}
                      {new Date(c.validUntil).toLocaleDateString("en-IN")}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <input
                          className="w-40 rounded border border-slate-200 px-2 py-1 text-xs"
                          placeholder="email"
                          value={emailTo[c.code] ?? ""}
                          onChange={(e) =>
                            setEmailTo({ ...emailTo, [c.code]: e.target.value })
                          }
                        />
                        <button
                          type="button"
                          className="text-xs font-medium text-brand-600"
                          disabled={email.isPending}
                          onClick={() => {
                            const to = emailTo[c.code];
                            if (!to) return;
                            void email.mutateAsync({ code: c.code, to });
                          }}
                        >
                          Send
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        className="text-xs text-slate-500 hover:text-slate-800"
                        onClick={() =>
                          setActive.mutate({
                            code: c.code,
                            isActive: !c.isActive,
                          })
                        }
                      >
                        {c.isActive ? "Deactivate" : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
