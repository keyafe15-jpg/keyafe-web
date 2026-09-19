import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useSearchParams } from "react-router-dom";
import { Field, inputClass, submitClass, textareaClass } from "@/components/form/Field";
import { MultiImageUpload } from "@/components/form/MultiImageUpload";
import { getQuoteSchema, type GetQuoteInput } from "@/lib/validators";
import {
  CORPORATE_EVENT_TYPES,
  CUSTOM_EVENT_TYPES,
  QUOTE_COPY,
  QUOTE_SEO,
  type QuoteKind,
} from "@/content/quote";
import { Seo } from "@/components/seo/Seo";
import { normalizeGstin } from "@/lib/gstin";
import { Reveal } from "@/components/motion/Reveal";
import { SlideCarousel } from "@/components/ui/SlideCarousel";
import { api } from "@/lib/api";
import { uploadImages } from "@/lib/uploads";
import { closedDayMessage, closureForDate, useShopClosures } from "@/hooks/useShopClosures";
import { cn } from "@/lib/cn";

function todayIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseKind(raw: string | null): QuoteKind | null {
  if (raw === "corporate" || raw === "custom") return raw;
  return null;
}

function QuoteChooser() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-12">
      <Seo title={QUOTE_SEO.title} description={QUOTE_SEO.description} />
      <Reveal>
        <div className="mb-10 text-center">
          <p className="mb-3 text-sm tracking-widest text-brand-500 uppercase">
            {QUOTE_COPY.chooser.eyebrow}
          </p>
          <h1 className="mb-4 font-display text-4xl text-ink-900 md:text-5xl">
            {QUOTE_COPY.chooser.title}
          </h1>
          <p className="mx-auto max-w-2xl text-ink-500">{QUOTE_COPY.chooser.intro}</p>
        </div>
      </Reveal>

      <div className="mx-auto grid max-w-3xl gap-4 sm:grid-cols-2">
        <Reveal delay={60}>
          <Link
            to="/get-quote?type=corporate"
            className="group flex h-full flex-col rounded-2xl border border-cream-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
          >
            <p className="text-[11px] font-semibold tracking-[0.2em] text-brand-500 uppercase">
              Business
            </p>
            <h2 className="mt-2 font-display text-2xl text-ink-900">
              {QUOTE_COPY.chooser.corporate.title}
            </h2>
            <p className="mt-2 flex-1 text-sm leading-6 text-ink-500">
              {QUOTE_COPY.chooser.corporate.body}
            </p>
            <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-brand-600 group-hover:gap-2">
              {QUOTE_COPY.chooser.corporate.cta}
              <span aria-hidden>→</span>
            </span>
          </Link>
        </Reveal>

        <Reveal delay={120}>
          <Link
            to="/get-quote?type=custom"
            className="group flex h-full flex-col rounded-2xl border border-cream-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
          >
            <p className="text-[11px] font-semibold tracking-[0.2em] text-ink-500 uppercase">
              Personal
            </p>
            <h2 className="mt-2 font-display text-2xl text-ink-900">
              {QUOTE_COPY.chooser.custom.title}
            </h2>
            <p className="mt-2 flex-1 text-sm leading-6 text-ink-500">
              {QUOTE_COPY.chooser.custom.body}
            </p>
            <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-brand-600 group-hover:gap-2">
              {QUOTE_COPY.chooser.custom.cta}
              <span aria-hidden>→</span>
            </span>
          </Link>
        </Reveal>
      </div>
    </section>
  );
}

function QuoteForm({ kind }: { kind: QuoteKind }) {
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [referenceImages, setReferenceImages] = useState<File[]>([]);

  const copy = kind === "corporate" ? QUOTE_COPY.corporate : QUOTE_COPY.custom;
  const seo = kind === "corporate" ? QUOTE_SEO.corporate : QUOTE_SEO.custom;
  const eventTypes = kind === "corporate" ? CORPORATE_EVENT_TYPES : CUSTOM_EVENT_TYPES;
  const descriptionCopy = QUOTE_COPY.fields.description[kind];

  const { data: closures = [] } = useShopClosures();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    formState: { errors },
  } = useForm<GetQuoteInput>({
    resolver: zodResolver(getQuoteSchema),
    defaultValues: { kind },
  });

  useEffect(() => {
    setValue("kind", kind);
    setSubmitted(false);
    setSubmitError(null);
    setReferenceImages([]);
    reset({ kind });
  }, [kind, reset, setValue]);

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
      const isCorporate = values.kind === "corporate";
      await api.post("/quotes", {
        name: values.name,
        phone: values.phone,
        email: values.email ?? null,
        address: values.address,
        deliveryDate: values.deliveryDate,
        description: values.description,
        notes: values.notes ?? null,
        referenceImages: uploaded.map((u) => u.publicUrl),
        companyName: isCorporate ? (values.companyName ?? null) : null,
        gstin: isCorporate ? (values.gstin ?? null) : null,
        headcount: values.headcount ? Number(values.headcount) : null,
        eventType: values.eventType || null,
      });
      setSubmitted(true);
      setReferenceImages([]);
      reset({ kind });
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
    <section className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
      <Seo title={seo.title} description={seo.description} />

      <Reveal>
        <div className="mb-4 flex flex-wrap items-center justify-center gap-2">
          <Link
            to="/get-quote?type=corporate"
            className={cn(
              "rounded-full px-4 py-1.5 text-xs font-semibold tracking-wide uppercase transition",
              kind === "corporate"
                ? "bg-brand-500 text-white"
                : "border border-cream-200 bg-white text-ink-600 hover:border-brand-300",
            )}
          >
            Corporate
          </Link>
          <Link
            to="/get-quote?type=custom"
            className={cn(
              "rounded-full px-4 py-1.5 text-xs font-semibold tracking-wide uppercase transition",
              kind === "custom"
                ? "bg-brand-500 text-white"
                : "border border-cream-200 bg-white text-ink-600 hover:border-brand-300",
            )}
          >
            Custom order
          </Link>
        </div>
      </Reveal>

      <Reveal>
        <div className="mb-5 text-center">
          <p className="mb-1.5 text-[11px] font-semibold tracking-[0.22em] text-brand-500 uppercase">
            {copy.eyebrow}
          </p>
          <h1 className="font-display text-2xl text-ink-900 sm:text-4xl">{copy.title}</h1>
          <p className="mx-auto mt-2 max-w-lg text-sm text-ink-500">{copy.intro}</p>
        </div>
      </Reveal>

      <Reveal delay={60}>
        <div className="mx-auto mb-4 max-w-2xl overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <ul className="flex w-max gap-2 px-1 pb-1">
            {copy.offerings.map((item) => (
              <li
                key={item}
                className="shrink-0 rounded-full border border-cream-200 bg-white/80 px-3 py-1 text-[11px] font-medium text-ink-700"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
      </Reveal>

      <Reveal delay={100}>
        <SlideCarousel
          ariaLabel="Why enquire with us"
          slideClassName="w-full"
          className="mx-auto mb-6 max-w-2xl rounded-2xl border border-cream-200 bg-cream-50/70 px-4 py-4"
        >
          {copy.trust.map((item) => (
            <div key={item.title} className="min-h-[4.25rem] text-left">
              <p className="font-display text-base text-ink-900">{item.title}</p>
              <p className="mt-1 text-sm leading-5 text-ink-500">{item.body}</p>
            </div>
          ))}
        </SlideCarousel>
      </Reveal>

      <h2 className="mb-3 text-center font-display text-xl text-ink-900 sm:text-2xl">
        {copy.formHeading}
      </h2>

      <form
        onSubmit={onSubmit}
        noValidate
        className="mx-auto max-w-2xl space-y-5 rounded-card border border-cream-200 bg-white p-5 shadow-sm sm:p-6 md:p-8"
      >
        <input type="hidden" {...register("kind")} />

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

        {kind === "corporate" && (
          <div className="grid gap-4 rounded-lg border border-cream-200 bg-cream-50/60 p-4 sm:grid-cols-2">
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
                  onChange: (e) => setValue("gstin", normalizeGstin(e.target.value).slice(0, 15)),
                })}
              />
            </Field>
          </div>
        )}

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
              {eventTypes.map((option) => (
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

        <Field
          label={descriptionCopy.label}
          required
          error={errors.description?.message}
          hint={descriptionCopy.hint}
        >
          <textarea
            rows={5}
            aria-required="true"
            className={textareaClass}
            placeholder={descriptionCopy.placeholder}
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

        <p className="text-center text-xs text-ink-500">
          <Link to="/get-quote" className="font-medium text-brand-600 hover:underline">
            {QUOTE_COPY.switchKind}
          </Link>
        </p>
      </form>
    </section>
  );
}

export function GetQuotePage() {
  const [params] = useSearchParams();
  const kind = useMemo(() => parseKind(params.get("type")), [params]);

  if (!kind) return <QuoteChooser />;
  return <QuoteForm kind={kind} />;
}
