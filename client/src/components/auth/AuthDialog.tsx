import * as Dialog from "@radix-ui/react-dialog";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState, type ReactNode } from "react";
import { useForm, type UseFormRegisterReturn } from "react-hook-form";
import { useAuth } from "@/store/auth";
import {
  forgotPasswordSchema,
  formatPhoneWithCountryCode,
  otpAuthSchema,
  passwordLoginSchema,
  passwordRegisterSchema,
  type ForgotPasswordInput,
  type OtpAuthInput,
  type PasswordLoginInput,
  type PasswordRegisterInput,
} from "@/lib/validators";
import { Field, inputClass, submitClass } from "@/components/form/Field";
import { AUTH_COPY } from "@/content/auth";
import { cn } from "@/lib/cn";

type AuthStep = "phone" | "otp" | "profile";
type AuthMode = "password" | "otp" | "register" | "forgot";

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

const MODE_HEADINGS: Record<AuthMode, { title: string; subtitle: string }> = {
  password: AUTH_COPY.password,
  otp: { title: AUTH_COPY.title, subtitle: AUTH_COPY.subtitle },
  register: AUTH_COPY.register,
  forgot: AUTH_COPY.forgot,
};

const linkClass = "font-medium text-brand-500 hover:underline";

interface AuthDialogProps {
  trigger: ReactNode;
}

export function AuthDialog({ trigger }: AuthDialogProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<AuthMode>("password");
  const clearError = useAuth((s) => s.clearError);

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      clearError();
      setMode("password");
    }
  };
  const switchMode = (next: AuthMode) => {
    clearError();
    setMode(next);
  };
  const close = () => onOpenChange(false);
  const heading = MODE_HEADINGS[mode];

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="data-[state=open]:animate-in data-[state=open]:fade-in fixed inset-0 z-50 bg-ink-900/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 max-h-[92svh] w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-cream-200 bg-cream-50 p-6 shadow-2xl focus:outline-none">
          <Dialog.Title className="mb-1 font-display text-2xl text-ink-900">
            {heading.title}
          </Dialog.Title>
          <Dialog.Description className="mb-5 text-sm text-ink-500">
            {heading.subtitle}
          </Dialog.Description>

          {mode === "password" && <PasswordLoginForm onSuccess={close} onSwitch={switchMode} />}
          {mode === "otp" && (
            <>
              <OtpAuthForm onSuccess={close} />
              <p className="mt-4 text-center text-sm text-ink-500">
                <button type="button" className={linkClass} onClick={() => switchMode("password")}>
                  {AUTH_COPY.password.usePassword}
                </button>
              </p>
            </>
          )}
          {mode === "register" && <RegisterForm onSuccess={close} onSwitch={switchMode} />}
          {mode === "forgot" && <ForgotPasswordForm onSwitch={switchMode} />}

          <Dialog.Close
            className="absolute top-3 right-3 rounded-full p-1 text-ink-500 transition hover:bg-cream-100 hover:text-ink-900"
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

function CountryPhoneInput({
  countryProps,
  phoneProps,
  trailing,
}: {
  countryProps: UseFormRegisterReturn;
  phoneProps: UseFormRegisterReturn;
  trailing?: ReactNode;
}) {
  return (
    <div className="flex items-stretch gap-2">
      <input
        list="country-codes"
        aria-label={AUTH_COPY.fields.countryCode.label}
        className="border-brand-400 w-[100px] shrink-0 rounded-xl border bg-white px-2 py-2 text-lg font-medium text-ink-900 transition outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
        placeholder="🇮🇳 +91"
        {...countryProps}
      />
      <datalist id="country-codes">
        {COUNTRY_OPTIONS.map((country) => (
          <option key={`${country.code}-${country.label}`} value={country.code}>
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
        {...phoneProps}
      />
      {trailing}
    </div>
  );
}

function ErrorNote() {
  const error = useAuth((s) => s.error);
  return error ? <p className="text-sm text-brand-500">{error}</p> : null;
}

function PasswordLoginForm({
  onSuccess,
  onSwitch,
}: {
  onSuccess: () => void;
  onSwitch: (mode: AuthMode) => void;
}) {
  const loginWithPassword = useAuth((s) => s.loginWithPassword);
  const isSubmitting = useAuth((s) => s.isSubmitting);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PasswordLoginInput>({
    resolver: zodResolver(passwordLoginSchema),
    defaultValues: { countryCode: "+91", phone: "", password: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    const phone = formatPhoneWithCountryCode(values.countryCode, values.phone);
    if (await loginWithPassword({ phone, password: values.password })) onSuccess();
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field
        label={AUTH_COPY.fields.phone.label}
        required
        error={errors.phone?.message || errors.countryCode?.message}
      >
        <CountryPhoneInput countryProps={register("countryCode")} phoneProps={register("phone")} />
      </Field>
      <Field label={AUTH_COPY.fields.password.label} required error={errors.password?.message}>
        <input
          type="password"
          autoComplete="current-password"
          aria-required="true"
          className={inputClass}
          {...register("password")}
        />
      </Field>
      <div className="-mt-2 text-right">
        <button
          type="button"
          className="text-xs text-brand-500 hover:underline"
          onClick={() => onSwitch("forgot")}
        >
          {AUTH_COPY.password.forgot}
        </button>
      </div>

      <ErrorNote />

      <button type="submit" disabled={isSubmitting} className={submitClass}>
        {isSubmitting ? AUTH_COPY.password.submitting : AUTH_COPY.password.submit}
      </button>

      <div className="space-y-1.5 text-center text-sm text-ink-500">
        <p>
          <button type="button" className={linkClass} onClick={() => onSwitch("otp")}>
            {AUTH_COPY.password.useOtp}
          </button>
        </p>
        <p>
          {AUTH_COPY.password.newHere}{" "}
          <button type="button" className={linkClass} onClick={() => onSwitch("register")}>
            {AUTH_COPY.password.createLink}
          </button>
        </p>
      </div>
    </form>
  );
}

function RegisterForm({
  onSuccess,
  onSwitch,
}: {
  onSuccess: () => void;
  onSwitch: (mode: AuthMode) => void;
}) {
  const registerWithPassword = useAuth((s) => s.registerWithPassword);
  const isSubmitting = useAuth((s) => s.isSubmitting);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PasswordRegisterInput>({
    resolver: zodResolver(passwordRegisterSchema),
    defaultValues: { countryCode: "+91", name: "", phone: "", email: "", password: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    const ok = await registerWithPassword({
      name: values.name,
      phone: formatPhoneWithCountryCode(values.countryCode, values.phone),
      email: values.email,
      password: values.password,
    });
    if (ok) onSuccess();
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label={AUTH_COPY.fields.name.label} required error={errors.name?.message}>
        <input
          autoComplete="name"
          className={inputClass}
          placeholder="Your name"
          {...register("name")}
        />
      </Field>
      <Field
        label={AUTH_COPY.fields.phone.label}
        required
        error={errors.phone?.message || errors.countryCode?.message}
      >
        <CountryPhoneInput countryProps={register("countryCode")} phoneProps={register("phone")} />
      </Field>
      <Field
        label={AUTH_COPY.fields.email.label}
        hint={AUTH_COPY.register.emailHint}
        error={errors.email?.message}
      >
        <input
          type="email"
          autoComplete="email"
          className={inputClass}
          placeholder="you@example.com"
          {...register("email")}
        />
      </Field>
      <Field
        label={AUTH_COPY.fields.newPassword.label}
        hint={AUTH_COPY.fields.newPassword.hint}
        required
        error={errors.password?.message}
      >
        <input
          type="password"
          autoComplete="new-password"
          aria-required="true"
          className={inputClass}
          {...register("password")}
        />
      </Field>

      <ErrorNote />

      <button type="submit" disabled={isSubmitting} className={submitClass}>
        {isSubmitting ? AUTH_COPY.register.submitting : AUTH_COPY.register.submit}
      </button>

      <p className="text-center text-sm text-ink-500">
        {AUTH_COPY.register.haveAccount}{" "}
        <button type="button" className={linkClass} onClick={() => onSwitch("password")}>
          {AUTH_COPY.register.loginLink}
        </button>
      </p>
    </form>
  );
}

function ForgotPasswordForm({ onSwitch }: { onSwitch: (mode: AuthMode) => void }) {
  const requestPasswordReset = useAuth((s) => s.requestPasswordReset);
  const [sentMessage, setSentMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { countryCode: "+91", phone: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      const phone = formatPhoneWithCountryCode(values.countryCode, values.phone);
      setSentMessage(await requestPasswordReset(phone));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the reset link");
    }
  });

  const backLink = (
    <p className="text-center text-sm">
      <button type="button" className={linkClass} onClick={() => onSwitch("password")}>
        {AUTH_COPY.forgot.back}
      </button>
    </p>
  );

  if (sentMessage) {
    return (
      <div className="space-y-4">
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{sentMessage}</p>
        <p className="text-sm text-ink-500">{AUTH_COPY.forgot.noEmail}</p>
        {backLink}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field
        label={AUTH_COPY.fields.phone.label}
        required
        error={errors.phone?.message || errors.countryCode?.message}
      >
        <CountryPhoneInput countryProps={register("countryCode")} phoneProps={register("phone")} />
      </Field>

      {error && <p className="text-sm text-brand-500">{error}</p>}

      <button type="submit" disabled={isSubmitting} className={submitClass}>
        {isSubmitting ? AUTH_COPY.forgot.submitting : AUTH_COPY.forgot.submit}
      </button>
      {backLink}
    </form>
  );
}

function OtpAuthForm({ onSuccess }: { onSuccess: () => void }) {
  const sendOtp = useAuth((s) => s.sendOtp);
  const continueWithOtp = useAuth((s) => s.continueWithOtp);
  const isSubmitting = useAuth((s) => s.isSubmitting);
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
    const combinedPhone = formatPhoneWithCountryCode(values.countryCode, values.phone);

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

  const currentStepLabel = step === "profile" ? AUTH_COPY.createAccount : AUTH_COPY.submit;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {step === "phone" && (
        <Field
          label={AUTH_COPY.fields.phone.label}
          required
          error={errors.phone?.message || errors.countryCode?.message}
        >
          <CountryPhoneInput
            countryProps={register("countryCode")}
            phoneProps={register("phone")}
            trailing={
              <button
                type="button"
                onClick={() => void onSendOtp()}
                disabled={isSubmitting}
                className="text-brand-600 hover:bg-brand-50 shrink-0 rounded-xl border border-brand-500 bg-transparent px-4 py-2 text-sm font-medium whitespace-nowrap transition disabled:opacity-60"
              >
                {AUTH_COPY.sendOtp}
              </button>
            }
          />
        </Field>
      )}

      {step !== "phone" && (
        <>
          <Field label={AUTH_COPY.fields.otp.label} required error={errors.otp?.message}>
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

      <ErrorNote />

      {step !== "phone" && (
        <button type="submit" disabled={isSubmitting} className={submitClass}>
          {isSubmitting ? AUTH_COPY.submitting : currentStepLabel}
        </button>
      )}
    </form>
  );
}
