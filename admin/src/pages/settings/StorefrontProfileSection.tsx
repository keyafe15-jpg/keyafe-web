import { useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { Field, inputClass, submitClass } from "@/components/form/Field";
import {
  useStorefrontProfile,
  useUpdateStorefrontProfile,
  type PlatformRating,
  type StorefrontProfile,
} from "@/hooks/useStorefrontProfile";
import { storefrontOrigin } from "@/lib/storefront";
import { uploadImage } from "@/lib/uploads";
import { InfoRow, SectionHeader } from "./SettingsSection";

const builtInLogo = () => `${storefrontOrigin()}/logo.png`;

type Form = {
  tagline: string;
  logoUrl: string;
  instagram: string;
  facebook: string;
  zomato: string;
  swiggy: string;
  zomatoRating: string;
  zomatoCount: string;
  swiggyRating: string;
  swiggyCount: string;
  street: string;
  locality: string;
  city: string;
  region: string;
  postalCode: string;
  areaServed: string;
  openingHours: string;
};

function toForm(p: StorefrontProfile | undefined): Form {
  return {
    tagline: p?.tagline ?? "",
    logoUrl: p?.logoUrl ?? "",
    instagram: p?.socialLinks.instagram ?? "",
    facebook: p?.socialLinks.facebook ?? "",
    zomato: p?.socialLinks.zomato ?? "",
    swiggy: p?.socialLinks.swiggy ?? "",
    zomatoRating: p?.platformRatings.zomato?.rating.toString() ?? "",
    zomatoCount: p?.platformRatings.zomato?.count.toString() ?? "",
    swiggyRating: p?.platformRatings.swiggy?.rating.toString() ?? "",
    swiggyCount: p?.platformRatings.swiggy?.count.toString() ?? "",
    street: p?.publicLocation.street ?? "",
    locality: p?.publicLocation.locality ?? "",
    city: p?.publicLocation.city ?? "",
    region: p?.publicLocation.region ?? "",
    postalCode: p?.publicLocation.postalCode ?? "",
    areaServed: p?.publicLocation.areaServed.join(", ") ?? "",
    openingHours: p?.publicLocation.openingHours ?? "",
  };
}

function toRating(label: string, rating: string, count: string): PlatformRating | null {
  if (!rating.trim() && !count.trim()) return null;
  const r = Number(rating);
  const c = Number(count || "0");
  if (!rating.trim() || Number.isNaN(r) || r < 0 || r > 5) {
    throw new Error(`${label} rating must be between 0 and 5, or leave both boxes blank.`);
  }
  if (!Number.isInteger(c) || c < 0) {
    throw new Error(`${label} rating count must be a whole number.`);
  }
  return { rating: r, count: c };
}

function toProfile(f: Form): StorefrontProfile {
  return {
    tagline: f.tagline.trim() || null,
    logoUrl: f.logoUrl || null,
    socialLinks: {
      instagram: f.instagram.trim() || null,
      facebook: f.facebook.trim() || null,
      zomato: f.zomato.trim() || null,
      swiggy: f.swiggy.trim() || null,
    },
    platformRatings: {
      zomato: toRating("Zomato", f.zomatoRating, f.zomatoCount),
      swiggy: toRating("Swiggy", f.swiggyRating, f.swiggyCount),
    },
    publicLocation: {
      street: f.street.trim(),
      locality: f.locality.trim(),
      city: f.city.trim(),
      region: f.region.trim(),
      postalCode: f.postalCode.trim(),
      areaServed: f.areaServed
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      openingHours: f.openingHours.trim(),
    },
  };
}

function ratingText(r: PlatformRating | null | undefined) {
  return r ? `${r.rating.toFixed(1)} ★ · ${r.count.toLocaleString("en-IN")} ratings` : null;
}

function linkValue(href: string | null | undefined) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="break-all text-brand-700 hover:underline"
    >
      {href}
    </a>
  );
}

export function StorefrontProfileSection() {
  const { data, isLoading } = useStorefrontProfile();
  const update = useUpdateStorefrontProfile();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Form>(() => toForm(undefined));
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const startEdit = () => {
    setForm(toForm(data));
    setError(null);
    setEditing(true);
  };

  const onLogo = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const res = await uploadImage(file, "admin");
      setForm((f) => ({ ...f, logoUrl: res.publicUrl }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    setError(null);
    try {
      await update.mutateAsync(toProfile(form));
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    }
  };

  const loc = data?.publicLocation;
  const address = loc
    ? [loc.street, loc.locality, loc.city, loc.region, loc.postalCode].filter(Boolean).join(", ")
    : "";

  return (
    <section className="mt-6 rounded-card border border-slate-200 bg-white p-5">
      <SectionHeader
        title="Website profile"
        description="Logo, tagline, links, delivery-app ratings and the address shown on the website and to Google. The shop name is the trade name in GST settings below."
        editing={editing}
        onEdit={startEdit}
        onCancel={() => setEditing(false)}
      />

      {isLoading ? (
        <p className="mt-4 text-sm text-slate-500">Loading…</p>
      ) : editing ? (
        <form
          className="mt-4 space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (!update.isPending && !uploading) void submit();
          }}
        >
          <div>
            <span className="mb-1 block text-xs font-medium tracking-wide text-slate-500 uppercase">
              Logo
            </span>
            <div className="flex items-center gap-3">
              <img
                src={form.logoUrl || builtInLogo()}
                alt="Logo preview"
                className="h-14 w-14 rounded-full border border-slate-200 bg-white object-cover"
              />
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                <ImagePlus className="h-3.5 w-3.5" />
                {uploading ? "Uploading…" : form.logoUrl ? "Replace" : "Upload"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  aria-label="Upload logo"
                  disabled={uploading}
                  onChange={(e) => {
                    void onLogo(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </label>
              {form.logoUrl && (
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, logoUrl: "" }))}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Use built-in
                </button>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Square image, at least 256 × 256. Leave empty for the built-in logo.
            </p>
          </div>

          <Field label="Tagline" hint="Shown to search engines and link previews.">
            <input
              value={form.tagline}
              onChange={set("tagline")}
              maxLength={160}
              className={inputClass}
            />
          </Field>

          <fieldset className="space-y-3">
            <legend className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
              Links
            </legend>
            <Field label="Instagram">
              <input
                type="url"
                value={form.instagram}
                onChange={set("instagram")}
                placeholder="https://instagram.com/…"
                className={inputClass}
              />
            </Field>
            <Field label="Facebook">
              <input
                type="url"
                value={form.facebook}
                onChange={set("facebook")}
                placeholder="https://facebook.com/…"
                className={inputClass}
              />
            </Field>
            <Field label="Zomato page">
              <input
                type="url"
                value={form.zomato}
                onChange={set("zomato")}
                placeholder="https://www.zomato.com/…"
                className={inputClass}
              />
            </Field>
            <Field label="Swiggy page">
              <input
                type="url"
                value={form.swiggy}
                onChange={set("swiggy")}
                placeholder="https://www.swiggy.com/…"
                className={inputClass}
              />
            </Field>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
              Delivery-app ratings
            </legend>
            <p className="text-xs text-slate-500">
              Copy these from Zomato and Swiggy now and then. Leave both boxes blank to hide a
              badge.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Zomato rating">
                <input
                  inputMode="decimal"
                  value={form.zomatoRating}
                  onChange={set("zomatoRating")}
                  placeholder="4.2"
                  className={inputClass}
                />
              </Field>
              <Field label="Zomato ratings count">
                <input
                  inputMode="numeric"
                  value={form.zomatoCount}
                  onChange={set("zomatoCount")}
                  placeholder="1198"
                  className={inputClass}
                />
              </Field>
              <Field label="Swiggy rating">
                <input
                  inputMode="decimal"
                  value={form.swiggyRating}
                  onChange={set("swiggyRating")}
                  placeholder="4.4"
                  className={inputClass}
                />
              </Field>
              <Field label="Swiggy ratings count">
                <input
                  inputMode="numeric"
                  value={form.swiggyCount}
                  onChange={set("swiggyCount")}
                  placeholder="224"
                  className={inputClass}
                />
              </Field>
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
              Public address (Google listing)
            </legend>
            <p className="text-xs text-slate-500">
              Keep this the same as your Google Business Profile. Blank parts are left out.
            </p>
            <Field label="Street">
              <input value={form.street} onChange={set("street")} className={inputClass} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Area / locality">
                <input
                  value={form.locality}
                  onChange={set("locality")}
                  placeholder="Belur"
                  className={inputClass}
                />
              </Field>
              <Field label="City">
                <input
                  value={form.city}
                  onChange={set("city")}
                  placeholder="Howrah"
                  className={inputClass}
                />
              </Field>
              <Field label="State">
                <input
                  value={form.region}
                  onChange={set("region")}
                  placeholder="West Bengal"
                  className={inputClass}
                />
              </Field>
              <Field label="Pincode">
                <input
                  inputMode="numeric"
                  maxLength={6}
                  value={form.postalCode}
                  onChange={set("postalCode")}
                  placeholder="711202"
                  className={inputClass}
                />
              </Field>
            </div>
            <Field label="Areas served" hint="Comma-separated cities.">
              <input
                value={form.areaServed}
                onChange={set("areaServed")}
                placeholder="Kolkata, Howrah, Hooghly"
                className={inputClass}
              />
            </Field>
            <Field label="Opening hours" hint='Google format, e.g. "Mo-Su 11:00-23:00".'>
              <input
                value={form.openingHours}
                onChange={set("openingHours")}
                className={inputClass}
              />
            </Field>
          </fieldset>

          {error && <p className="text-xs text-red-700">{error}</p>}
          <button type="submit" disabled={update.isPending || uploading} className={submitClass}>
            {update.isPending ? "Saving…" : "Save"}
          </button>
        </form>
      ) : (
        <dl className="mt-4 space-y-3 rounded-lg border border-slate-100 bg-slate-50/70 p-4">
          <InfoRow
            label="Logo"
            value={
              <img
                src={data?.logoUrl || builtInLogo()}
                alt="Logo"
                className="h-10 w-10 rounded-full border border-slate-200 bg-white object-cover"
              />
            }
          />
          <InfoRow label="Tagline" value={data?.tagline} />
          <InfoRow label="Instagram" value={linkValue(data?.socialLinks.instagram)} />
          <InfoRow label="Facebook" value={linkValue(data?.socialLinks.facebook)} />
          <InfoRow label="Zomato page" value={linkValue(data?.socialLinks.zomato)} />
          <InfoRow label="Swiggy page" value={linkValue(data?.socialLinks.swiggy)} />
          <InfoRow label="Zomato rating" value={ratingText(data?.platformRatings.zomato)} />
          <InfoRow label="Swiggy rating" value={ratingText(data?.platformRatings.swiggy)} />
          <InfoRow label="Public address" value={address} />
          <InfoRow label="Areas served" value={loc?.areaServed.join(", ")} />
          <InfoRow label="Opening hours" value={loc?.openingHours} />
        </dl>
      )}
    </section>
  );
}
