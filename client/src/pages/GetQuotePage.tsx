import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { Field, inputClass, submitClass, textareaClass } from "@/components/form/Field";
import { MultiImageUpload } from "@/components/form/MultiImageUpload";
import { getQuoteSchema, type GetQuoteInput } from "@/lib/validators";
import { QUOTE_COPY, QUOTE_EVENT_TYPES, QUOTE_SEO } from "@/content/quote";
import { Seo } from "@/components/seo/Seo";
import { normalizeGstin } from "@/lib/gstin";
import { Reveal } from "@/components/motion/Reveal";
import { api } from "@/lib/api";
import { uploadImages } from "@/lib/uploads";
import { closedDayMessage, closureForDate, useShopClosures } from "@/hooks/useShopClosures";

function todayIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function GetQuotePage() {
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [referenceImages, setReferenceImages] = useState<File[]>([]);

  const { data: closures = [] } = useShopClosures();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    watch,
    formState: { errors },
  } = useForm<GetQuoteInput>({
    resolver: zodResolver(getQuoteSchema),
  });

  const isBusiness = watch("isBusiness") ?? false;

  const onSubmit = handleSubmit(async (values) => {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const closed = closureForDate(closures, values.deliveryDate);
      if (closed) {
        setError("deliveryDate", { message: closedDayMessage(closed) });
        setIsSubmitting(false);
        return;
      }
      const uploaded = referenceImages.length
        ? await uploadImages(referenceImages, "quote-reference")
        : [];
      await api.post("/quotes", {
        name: values.name,
        phone: values.phone,
        email: values.email ?? null,
        address: values.address,
        deliveryDate: values.deliveryDate,
        description: values.description,
        notes: values.notes ?? null,
        referenceImages: uploaded.map((u) => u.publicUrl),
        // Company details only travel when the business box is ticked, so
        // unticking it can't leave a stale GSTIN on the enquiry.
        companyName: values.isBusiness ? (values.companyName ?? null) : null,
        gstin: values.isBusiness ? (values.gstin ?? null) : null,
        headcount: values.headcount ? Number(values.headcount) : null,
        eventType: values.eventType ?? null,
      });
      setSubmitted(true);
      setReferenceImages([]);
      reset();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Could not send your request.");
    } finally {
      setIsSubmitting(false);
    }
  });

  if (submitted) {
    return (
      <section className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="mb-3 font-display text-4xl text-ink-900">{QUOTE_COPY.successTitle}</h1>
        <p className="mb-8 text-ink-500">{QUOTE_COPY.successBody}</p>
        <div className="flex justify-center gap-3">
          <Link
            to="/"
            className="rounded-full bg-brand-500 px-6 py-3 text-sm font-medium text-white transition hover:bg-brand-700"
          >
            {QUOTE_COPY.backToHome}
          </Link>
          <button
            type="button"
            onClick={() => setSubmitted(false)}
            className="rounded-full border border-ink-700 px-6 py-3 text-sm font-medium text-ink-700 transition hover:bg-cream-100"
          >
            {QUOTE_COPY.submitAnother}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-5xl px-4 py-12">
      <Seo title={QUOTE_SEO.title} description={QUOTE_SEO.description} />
      <Reveal>
        <div className="mb-8 text-center">
          <p className="mb-3 text-sm tracking-widest text-brand-500 uppercase">
            {QUOTE_COPY.eyebrow}
          </p>
          <h1 className="mb-4 font-display text-4xl text-ink-900 md:text-5xl">
            {QUOTE_COPY.title}
          </h1>
          <p className="mx-auto max-w-2xl text-ink-500">{QUOTE_COPY.intro}</p>
        </div>
      </Reveal>

      <Reveal delay={80}>
        <ul className="mx-auto mb-8 flex max-w-3xl flex-wrap justify-center gap-2">
          {QUOTE_COPY.offerings.map((item) => (
            <li
              key={item}
              className="rounded-full border border-cream-200 bg-white/70 px-3 py-1.5 text-xs font-medium text-ink-700"
            >
              {item}
            </li>
          ))}
        </ul>
      </Reveal>

      <Reveal delay={140}>
        <dl className="mb-10 grid gap-5 rounded-card border border-cream-200 bg-cream-50/60 p-6 sm:grid-cols-3">
          {QUOTE_COPY.trust.map((item) => (
            <div key={item.title}>
              <dt className="font-display text-base text-ink-900">{item.title}</dt>
              <dd className="mt-1 text-sm leading-6 text-ink-500">{item.body}</dd>
            </div>
          ))}
        </dl>
      </Reveal>

      <h2 className="mb-4 text-center font-display text-2xl text-ink-900">
        {QUOTE_COPY.formHeading}
      </h2>

      <form
        onSubmit={onSubmit}
        noValidate
        className="mx-auto max-w-2xl space-y-5 rounded-card border border-cream-200 bg-white p-6 shadow-sm md:p-8"
      >
        <div className="grid gap-5 md:grid-cols-2">
          <Field label={QUOTE_COPY.fields.name.label} required error={errors.name?.message}>
            <input
              autoComplete="name"
              aria-required="true"
              className={inputClass}
              {...register("name")}
            />
          </Field>
          <Field label={QUOTE_COPY.fields.phone.label} required error={errors.phone?.message}>
            <input
              type="tel"
              autoComplete="tel"
              placeholder={QUOTE_COPY.fields.phone.placeholder}
              aria-required="true"
              className={inputClass}
              {...register("phone")}
            />
          </Field>
        </div>

        <Field
          label={QUOTE_COPY.fields.email.label}
          error={errors.email?.message}
          hint={QUOTE_COPY.fields.email.hint}
        >
          <input type="email" autoComplete="email" className={inputClass} {...register("email")} />
        </Field>

        <Field
          label={QUOTE_COPY.fields.address.label}
          required
          error={errors.address?.message}
          hint={QUOTE_COPY.fields.address.hint}
        >
          <textarea
            rows={3}
            autoComplete="street-address"
            aria-required="true"
            className={textareaClass}
            {...register("address")}
          />
        </Field>

        <Field
          label={QUOTE_COPY.fields.deliveryDate.label}
          required
          error={errors.deliveryDate?.message}
        >
          <input
            type="date"
            min={todayIso()}
            aria-required="true"
            className={inputClass}
            {...register("deliveryDate")}
          />
        </Field>

        <div className="grid gap-5 md:grid-cols-2">
          <Field label={QUOTE_COPY.fields.eventType.label} hint={QUOTE_COPY.fields.eventType.hint}>
            <select className={inputClass} defaultValue="" {...register("eventType")}>
              <option value="">Select an occasion</option>
              {QUOTE_EVENT_TYPES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label={QUOTE_COPY.fields.headcount.label}
            error={errors.headcount?.message}
            hint={QUOTE_COPY.fields.headcount.hint}
          >
            <input
              type="number"
              min={1}
              inputMode="numeric"
              placeholder={QUOTE_COPY.fields.headcount.placeholder}
              className={inputClass}
              {...register("headcount")}
            />
          </Field>
        </div>

        {/* Collapsed by default: most enquiries are personal, and only a
            business claiming input tax credit needs to give a GSTIN. */}
        <div>
          <label className="flex cursor-pointer items-start gap-2">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-cream-200 text-brand-500 focus:ring-brand-500/20"
              {...register("isBusiness")}
            />
            <span className="text-sm font-medium text-ink-700">
              {QUOTE_COPY.fields.isBusiness.label}
              <span className="block text-xs font-normal text-ink-500">
                {QUOTE_COPY.fields.isBusiness.hint}
              </span>
            </span>
          </label>

          {isBusiness && (
            <div className="mt-3 grid gap-4 rounded-lg border border-cream-200 bg-cream-50/60 p-4 sm:grid-cols-2">
              <Field
                label={QUOTE_COPY.fields.companyName.label}
                required
                error={errors.companyName?.message}
              >
                <input
                  type="text"
                  placeholder={QUOTE_COPY.fields.companyName.placeholder}
                  className={inputClass}
                  {...register("companyName")}
                />
              </Field>
              <Field
                label={QUOTE_COPY.fields.gstin.label}
                error={errors.gstin?.message}
                hint={QUOTE_COPY.fields.gstin.hint}
              >
                <input
                  type="text"
                  placeholder={QUOTE_COPY.fields.gstin.placeholder}
                  autoCapitalize="characters"
                  spellCheck={false}
                  className={`${inputClass} font-mono tracking-wide`}
                  {...register("gstin", {
                    // Normalise as they type so a pasted GSTIN with spaces or
                    // lowercase still passes the checksum.
                    onChange: (e) => setValue("gstin", normalizeGstin(e.target.value).slice(0, 15)),
                  })}
                />
              </Field>
            </div>
          )}
        </div>

        <Field
          label={QUOTE_COPY.fields.description.label}
          required
          error={errors.description?.message}
          hint={QUOTE_COPY.fields.description.hint}
        >
          <textarea
            rows={5}
            aria-required="true"
            className={textareaClass}
            placeholder={QUOTE_COPY.fields.description.placeholder}
            {...register("description")}
          />
        </Field>

        <Field label={QUOTE_COPY.fields.image.label} hint={QUOTE_COPY.fields.image.hint}>
          <MultiImageUpload value={referenceImages} onChange={setReferenceImages} max={4} />
        </Field>

        <Field
          label={QUOTE_COPY.fields.notes.label}
          error={errors.notes?.message}
          hint={QUOTE_COPY.fields.notes.hint}
        >
          <textarea rows={3} className={textareaClass} {...register("notes")} />
        </Field>

        {submitError && (
          <p className="text-sm text-brand-700" role="alert">
            {submitError}
          </p>
        )}

        <button type="submit" disabled={isSubmitting} className={submitClass}>
          {isSubmitting ? QUOTE_COPY.submittingCta : QUOTE_COPY.submitCta}
        </button>
      </form>
    </section>
  );
}
