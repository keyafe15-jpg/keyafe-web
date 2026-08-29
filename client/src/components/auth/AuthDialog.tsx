import * as Dialog from "@radix-ui/react-dialog";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { useAuth } from "@/store/auth";
import {
  formatPhoneWithCountryCode,
  otpAuthSchema,
  type OtpAuthInput,
} from "@/lib/validators";
import { Field, inputClass, submitClass } from "@/components/form/Field";
import { AUTH_COPY } from "@/content/auth";
import { cn } from "@/lib/cn";

type AuthStep = "phone" | "otp" | "profile";

const COUNTRY_OPTIONS = [
  { code: "+91", label: "India (+91)" },
  { code: "+1", label: "United States (+1)" },
  { code: "+44", label: "United Kingdom (+44)" },
  { code: "+61", label: "Australia (+61)" },
  { code: "+971", label: "UAE (+971)" },
  { code: "+65", label: "Singapore (+65)" },
  { code: "+971", label: "Dubai (+971)" },
  { code: "+92", label: "Pakistan (+92)" },
  { code: "+880", label: "Bangladesh (+880)" },
  { code: "+81", label: "Japan (+81)" },
  { code: "+33", label: "France (+33)" },
  { code: "+49", label: "Germany (+49)" },
  { code: "+966", label: "Saudi Arabia (+966)" },
  { code: "+41", label: "Switzerland (+41)" },
  { code: "+971", label: "Abu Dhabi (+971)" },
] as const;

interface AuthDialogProps {
  trigger: ReactNode;
}

export function AuthDialog({ trigger }: AuthDialogProps) {
  const [open, setOpen] = useState(false);
  const clearError = useAuth((s) => s.clearError);

  useEffect(() => {
    if (!open) clearError();
  }, [open, clearError]);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink-900/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-cream-200 bg-cream-50 p-6 shadow-2xl focus:outline-none">
          <Dialog.Title className="mb-1 font-display text-2xl text-ink-900">
            {AUTH_COPY.title}
          </Dialog.Title>
          <Dialog.Description className="mb-5 text-sm text-ink-500">
            {AUTH_COPY.subtitle}
          </Dialog.Description>

          <OtpAuthForm onSuccess={() => setOpen(false)} />

          <Dialog.Close
            className="absolute right-3 top-3 rounded-full p-1 text-ink-500 transition hover:bg-cream-100 hover:text-ink-900"
            aria-label="Close"
          >
            <svg
              width={20}
              height={20}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function OtpAuthForm({ onSuccess }: { onSuccess: () => void }) {
  const sendOtp = useAuth((s) => s.sendOtp);
  const continueWithOtp = useAuth((s) => s.continueWithOtp);
  const isSubmitting = useAuth((s) => s.isSubmitting);
  const error = useAuth((s) => s.error);
  const [step, setStep] = useState<AuthStep>("phone");

  const {
    register,
    handleSubmit,
    getValues,
    trigger,
    setError,
    formState: { errors },
  } = useForm<OtpAuthInput>({
    resolver: zodResolver(otpAuthSchema),
    defaultValues: {
      countryCode: "+91",
      phone: "",
      otp: "",
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    const combinedPhone = formatPhoneWithCountryCode(
      values.countryCode,
      values.phone,
    );

    if (step === "profile") {
      if (!values.name?.trim()) {
        setError("name", { message: "Please enter your name" });
        return;
      }

      const result = await continueWithOtp({
        phone: combinedPhone,
        otp: values.otp,
        name: values.name,
        email: values.email,
      });

      if (result && "requiresProfile" in result && result.requiresProfile) {
        setStep("profile");
        return;
      }

      if (useAuth.getState().user) onSuccess();
      return;
    }

    const result = await continueWithOtp({
      phone: combinedPhone,
      otp: values.otp,
      name: values.name,
      email: values.email,
    });
    if (result && "requiresProfile" in result && result.requiresProfile) {
      setStep("profile");
      return;
    }

    if (useAuth.getState().user) onSuccess();
  });

  const onSendOtp = async () => {
    const phone = getValues("phone");
    const countryCode = getValues("countryCode");
    const valid = await trigger(["countryCode", "phone"]);
    if (!valid) return;
    setStep("otp");
    await sendOtp(formatPhoneWithCountryCode(countryCode, phone));
  };

  const currentStepLabel =
    step === "profile" ? AUTH_COPY.createAccount : AUTH_COPY.submit;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {step === "phone" && (
        <Field
          label={AUTH_COPY.fields.phone.label}
          required
          error={errors.phone?.message || errors.countryCode?.message}
        >
          <div className="flex items-stretch gap-2">
            <input
              list="country-codes"
              aria-label={AUTH_COPY.fields.countryCode.label}
              className={cn(
                "w-[100px] shrink-0 rounded-xl border border-brand-400 bg-white px-2 py-2 text-lg font-medium text-ink-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20",
              )}
              placeholder="🇮🇳 +91"
              {...register("countryCode")}
            />
            <datalist id="country-codes">
              {COUNTRY_OPTIONS.map((country) => (
                <option
                  key={`${country.code}-${country.label}`}
                  value={country.code}
                >
                  {country.label}
                </option>
              ))}
            </datalist>
            <input
              type="tel"
              autoComplete="tel"
              placeholder={AUTH_COPY.fields.phone.placeholder}
              aria-required="true"
              className={cn("min-w-0 flex-1", inputClass)}
              {...register("phone")}
            />
            <button
              type="button"
              onClick={() => void onSendOtp()}
              disabled={isSubmitting}
              className="shrink-0 whitespace-nowrap rounded-xl border border-brand-500 bg-transparent px-4 py-2 text-sm font-medium text-brand-600 transition hover:bg-brand-50 disabled:opacity-60"
            >
              {AUTH_COPY.sendOtp}
            </button>
          </div>
        </Field>
      )}

      {step !== "phone" && (
        <>
          <Field
            label={AUTH_COPY.fields.otp.label}
            required
            error={errors.otp?.message}
          >
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              aria-required="true"
              placeholder="123456"
              className={inputClass}
              {...register("otp")}
            />
          </Field>

          {step === "profile" && (
            <>
              <Field
                label={AUTH_COPY.fields.name.label}
                error={errors.name?.message}
                hint={AUTH_COPY.fields.name.hint}
              >
                <input
                  autoComplete="name"
                  className={inputClass}
                  placeholder="Your name"
                  {...register("name")}
                />
              </Field>

              <Field
                label={AUTH_COPY.fields.email.label}
                error={errors.email?.message}
                hint={AUTH_COPY.fields.email.hint}
              >
                <input
                  type="email"
                  autoComplete="email"
                  className={inputClass}
                  placeholder="you@example.com"
                  {...register("email")}
                />
              </Field>
            </>
          )}
        </>
      )}

      {error && <p className="text-sm text-brand-500">{error}</p>}

      {step !== "phone" && (
        <button type="submit" disabled={isSubmitting} className={submitClass}>
          {isSubmitting ? AUTH_COPY.submitting : currentStepLabel}
        </button>
      )}
    </form>
  );
}
