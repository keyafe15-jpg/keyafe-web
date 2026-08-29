import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/store/auth";
import { useSavedAddresses, type SavedAddress } from "@/store/addresses";

export function SavedAddressesPage() {
  const user = useAuth((s) => s.user);
  const addresses = useSavedAddresses((s) => s.addresses);
  const loading = useSavedAddresses((s) => s.loading);
  const error = useSavedAddresses((s) => s.error);
  const fetchAddresses = useSavedAddresses((s) => s.fetchAddresses);
  const addAddress = useSavedAddresses((s) => s.addAddress);
  const removeAddress = useSavedAddresses((s) => s.removeAddress);
  const setDefault = useSavedAddresses((s) => s.setDefault);

  useEffect(() => {
    if (user) {
      void fetchAddresses();
    }
  }, [fetchAddresses, user]);

  const [form, setForm] = useState({
    label: "Home",
    recipientName: "",
    phone: "",
    line1: "",
    line2: "",
    landmark: "",
    mapSearchQuery: "",
    city: "Kolkata",
    state: "West Bengal",
    stateCode: "19",
    pincode: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const nextErrors: Record<string, string> = {};

    if (!form.recipientName.trim()) {
      nextErrors.recipientName = "Recipient name is required";
    }
    if (!form.phone.trim()) {
      nextErrors.phone = "Phone number is required";
    }
    if (!form.line1.trim()) {
      nextErrors.line1 = "Address line 1 is required";
    }
    if (!form.mapSearchQuery.trim() || form.mapSearchQuery.trim().length < 3) {
      nextErrors.mapSearchQuery = "Rapido search text is required";
    }
    if (!form.city.trim()) {
      nextErrors.city = "City is required";
    }
    if (!form.state.trim()) {
      nextErrors.state = "State is required";
    }
    if (!/^[1-9][0-9]{5}$/.test(form.pincode.trim())) {
      nextErrors.pincode = "Enter a valid 6-digit pincode";
    }

    return nextErrors;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const nextErrors = validateForm();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    void addAddress({
      ...form,
      id: crypto.randomUUID(),
      isDefault: addresses.length === 0,
    });

    setForm({
      label: "Home",
      recipientName: "",
      phone: "",
      line1: "",
      line2: "",
      landmark: "",
      mapSearchQuery: "",
      city: "Kolkata",
      state: "West Bengal",
      stateCode: "19",
      pincode: "",
    });
    setErrors({});
  };

  if (!user) {
    return <Navigate to="/" replace />;
  }

  return (
    <section className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-8 flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-brand-500">
            Profile
          </p>
          <h1 className="mt-2 font-display text-3xl text-ink-900">
            Saved addresses
          </h1>
        </div>
        <Link
          to="/"
          className="text-sm text-ink-500 transition hover:text-brand-500"
        >
          Back to home
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4 rounded-card border border-cream-200 bg-white p-5 shadow-sm">
          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          {loading ? (
            <p className="text-sm text-ink-500">Loading addresses...</p>
          ) : addresses.length === 0 ? (
            <p className="text-sm text-ink-500">
              No saved addresses yet. Add your first delivery spot below.
            </p>
          ) : (
            <ul className="space-y-3">
              {addresses.map((address) => (
                <AddressCard
                  key={address.id}
                  address={address}
                  onRemove={() => void removeAddress(address.id)}
                  onSetDefault={() => void setDefault(address.id)}
                />
              ))}
            </ul>
          )}
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-card border border-cream-200 bg-white p-5 shadow-sm"
        >
          <h2 className="mb-4 font-display text-xl text-ink-900">
            Add address
          </h2>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-500">
                Label
              </label>
              <input
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                className="w-full rounded-lg border border-cream-200 bg-white px-3 py-2 text-sm text-ink-900 focus:border-brand-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-500">
                Recipient name
              </label>
              <input
                value={form.recipientName}
                onChange={(e) => {
                  setForm({ ...form, recipientName: e.target.value });
                  setErrors((prev) => ({ ...prev, recipientName: "" }));
                }}
                className="w-full rounded-lg border border-cream-200 bg-white px-3 py-2 text-sm text-ink-900 focus:border-brand-500 focus:outline-none"
              />
              {errors.recipientName && (
                <p className="mt-1 text-xs text-red-600">
                  {errors.recipientName}
                </p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-500">
                Phone
              </label>
              <input
                value={form.phone}
                onChange={(e) => {
                  setForm({ ...form, phone: e.target.value });
                  setErrors((prev) => ({ ...prev, phone: "" }));
                }}
                className="w-full rounded-lg border border-cream-200 bg-white px-3 py-2 text-sm text-ink-900 focus:border-brand-500 focus:outline-none"
              />
              {errors.phone && (
                <p className="mt-1 text-xs text-red-600">{errors.phone}</p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-500">
                Address line 1
              </label>
              <input
                value={form.line1}
                onChange={(e) => {
                  setForm({ ...form, line1: e.target.value });
                  setErrors((prev) => ({ ...prev, line1: "" }));
                }}
                className="w-full rounded-lg border border-cream-200 bg-white px-3 py-2 text-sm text-ink-900 focus:border-brand-500 focus:outline-none"
              />
              {errors.line1 && (
                <p className="mt-1 text-xs text-red-600">{errors.line1}</p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-500">
                Address line 2
              </label>
              <input
                value={form.line2}
                onChange={(e) => setForm({ ...form, line2: e.target.value })}
                className="w-full rounded-lg border border-cream-200 bg-white px-3 py-2 text-sm text-ink-900 focus:border-brand-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-500">
                Landmark
              </label>
              <input
                value={form.landmark}
                onChange={(e) => setForm({ ...form, landmark: e.target.value })}
                className="w-full rounded-lg border border-cream-200 bg-white px-3 py-2 text-sm text-ink-900 focus:border-brand-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-500">
                Rapido / Uber search text
              </label>
              <input
                value={form.mapSearchQuery}
                onChange={(e) => {
                  setForm({ ...form, mapSearchQuery: e.target.value });
                  setErrors((prev) => ({ ...prev, mapSearchQuery: "" }));
                }}
                className="w-full rounded-lg border border-cream-200 bg-white px-3 py-2 text-sm text-ink-900 focus:border-brand-500 focus:outline-none"
                placeholder="e.g. Metro station, apartment name, nearby landmark"
              />
              {errors.mapSearchQuery && (
                <p className="mt-1 text-xs text-red-600">
                  {errors.mapSearchQuery}
                </p>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-500">
                  City
                </label>
                <input
                  value={form.city}
                  onChange={(e) => {
                    setForm({ ...form, city: e.target.value });
                    setErrors((prev) => ({ ...prev, city: "" }));
                  }}
                  className="w-full rounded-lg border border-cream-200 bg-white px-3 py-2 text-sm text-ink-900 focus:border-brand-500 focus:outline-none"
                />
                {errors.city && (
                  <p className="mt-1 text-xs text-red-600">{errors.city}</p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-500">
                  Pincode
                </label>
                <input
                  value={form.pincode}
                  onChange={(e) => {
                    setForm({ ...form, pincode: e.target.value });
                    setErrors((prev) => ({ ...prev, pincode: "" }));
                  }}
                  className="w-full rounded-lg border border-cream-200 bg-white px-3 py-2 text-sm text-ink-900 focus:border-brand-500 focus:outline-none"
                />
                {errors.pincode && (
                  <p className="mt-1 text-xs text-red-600">{errors.pincode}</p>
                )}
              </div>
            </div>

            <button
              type="submit"
              className="w-full rounded-full bg-brand-500 px-6 py-3 text-sm font-medium text-white transition hover:bg-brand-700"
            >
              Save address
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

function AddressCard({
  address,
  onRemove,
  onSetDefault,
}: {
  address: SavedAddress;
  onRemove: () => void;
  onSetDefault: () => void;
}) {
  return (
    <li className="rounded-xl border border-cream-200 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium text-ink-900">{address.label}</p>
            {address.isDefault && (
              <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-600">
                Default
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-ink-700">{address.recipientName}</p>
          <p className="text-sm text-ink-700">{address.phone}</p>
        </div>

        <div className="flex items-center gap-2">
          {!address.isDefault && (
            <button
              type="button"
              onClick={onSetDefault}
              className="text-xs text-brand-500 transition hover:text-brand-600"
            >
              Set default
            </button>
          )}
          <button
            type="button"
            onClick={onRemove}
            className="text-xs text-ink-500 transition hover:text-brand-500"
          >
            Remove
          </button>
        </div>
      </div>

      <p className="mt-3 text-sm text-ink-600">
        {address.line1}
        {address.line2 ? `, ${address.line2}` : ""}
      </p>
      {address.landmark && (
        <p className="text-sm text-ink-600">Near {address.landmark}</p>
      )}
      <p className="text-sm text-ink-600">
        {address.city}, {address.state} - {address.pincode}
      </p>
    </li>
  );
}
