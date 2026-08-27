import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import {
  Field,
  inputClass,
  submitClass,
  textareaClass,
} from "@/components/form/Field";
import { MultiImageUpload } from "@/components/form/MultiImageUpload";
import { getQuoteSchema, type GetQuoteInput } from "@/lib/validators";
import { QUOTE_COPY } from "@/content/quote";

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
  const [referenceImages, setReferenceImages] = useState<File[]>([]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<GetQuoteInput>({
    resolver: zodResolver(getQuoteSchema),
  });

  const onSubmit = handleSubmit(async (values) => {
    setIsSubmitting(true);
    // TODO: POST multipart/form-data to /api/quotes — wired in a later phase.
    await new Promise((r) => setTimeout(r, 700));
    console.log("Quote request", { ...values, referenceImages });
    setIsSubmitting(false);
    setSubmitted(true);
    setReferenceImages([]);
    reset();
  });

  if (submitted) {
    return (
      <section className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="mb-3 font-display text-4xl text-ink-900">
          {QUOTE_COPY.successTitle}
        </h1>
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
    <section className="mx-auto max-w-2xl px-4 py-12">
      <div className="mb-8 text-center">
        <p className="mb-3 text-sm uppercase tracking-widest text-brand-500">
          {QUOTE_COPY.eyebrow}
        </p>
        <h1 className="mb-4 font-display text-4xl text-ink-900 md:text-5xl">
          {QUOTE_COPY.title}
        </h1>
        <p className="mx-auto max-w-lg text-ink-500">{QUOTE_COPY.intro}</p>
      </div>

      <form
        onSubmit={onSubmit}
        noValidate
        className="space-y-5 rounded-card border border-cream-200 bg-white p-6 shadow-sm md:p-8"
      >
        <div className="grid gap-5 md:grid-cols-2">
          <Field
            label={QUOTE_COPY.fields.name.label}
            required
            error={errors.name?.message}
          >
            <input
              autoComplete="name"
              aria-required="true"
              className={inputClass}
              {...register("name")}
            />
          </Field>
          <Field
            label={QUOTE_COPY.fields.phone.label}
            required
            error={errors.phone?.message}
          >
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
          <input
            type="email"
            autoComplete="email"
            className={inputClass}
            {...register("email")}
          />
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

        <Field
          label={QUOTE_COPY.fields.image.label}
          hint={QUOTE_COPY.fields.image.hint}
        >
          <MultiImageUpload
            value={referenceImages}
            onChange={setReferenceImages}
            max={4}
          />
        </Field>

        <Field
          label={QUOTE_COPY.fields.notes.label}
          error={errors.notes?.message}
          hint={QUOTE_COPY.fields.notes.hint}
        >
          <textarea rows={3} className={textareaClass} {...register("notes")} />
        </Field>

        <button type="submit" disabled={isSubmitting} className={submitClass}>
          {isSubmitting ? QUOTE_COPY.submittingCta : QUOTE_COPY.submitCta}
        </button>
      </form>
    </section>
  );
}
