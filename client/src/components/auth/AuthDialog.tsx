import * as Dialog from "@radix-ui/react-dialog";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { useAuth } from "@/store/auth";
import {
  loginSchema,
  registerSchema,
  type LoginInput,
  type RegisterInput,
} from "@/lib/validators";
import { Field, inputClass, submitClass } from "@/components/form/Field";
import { AUTH_COPY } from "@/content/auth";
import { cn } from "@/lib/cn";

type Tab = "login" | "register";

interface AuthDialogProps {
  trigger: ReactNode;
  defaultTab?: Tab;
}

export function AuthDialog({ trigger, defaultTab = "login" }: AuthDialogProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>(defaultTab);
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
            {tab === "login" ? AUTH_COPY.login.title : AUTH_COPY.register.title}
          </Dialog.Title>
          <Dialog.Description className="mb-5 text-sm text-ink-500">
            {tab === "login"
              ? AUTH_COPY.login.subtitle
              : AUTH_COPY.register.subtitle}
          </Dialog.Description>

          <div className="mb-5 flex gap-1 rounded-full bg-cream-100 p-1">
            <TabButton active={tab === "login"} onClick={() => setTab("login")}>
              {AUTH_COPY.tabs.login}
            </TabButton>
            <TabButton
              active={tab === "register"}
              onClick={() => setTab("register")}
            >
              {AUTH_COPY.tabs.register}
            </TabButton>
          </div>

          {tab === "login" ? (
            <LoginForm onSuccess={() => setOpen(false)} />
          ) : (
            <RegisterForm onSuccess={() => setOpen(false)} />
          )}

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

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 rounded-full px-4 py-2 text-sm font-medium transition",
        active
          ? "bg-white text-ink-900 shadow-sm"
          : "text-ink-500 hover:text-ink-700",
      )}
    >
      {children}
    </button>
  );
}

function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const login = useAuth((s) => s.login);
  const isSubmitting = useAuth((s) => s.isSubmitting);
  const error = useAuth((s) => s.error);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const onSubmit = handleSubmit(async (values) => {
    await login(values);
    if (useAuth.getState().user) onSuccess();
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field
        label={AUTH_COPY.login.fields.phone.label}
        required
        error={errors.phone?.message}
      >
        <input
          type="tel"
          autoComplete="tel"
          placeholder={AUTH_COPY.login.fields.phone.placeholder}
          aria-required="true"
          className={inputClass}
          {...register("phone")}
        />
      </Field>
      <Field
        label={AUTH_COPY.login.fields.password.label}
        required
        error={errors.password?.message}
      >
        <input
          type="password"
          autoComplete="current-password"
          aria-required="true"
          className={inputClass}
          {...register("password")}
        />
      </Field>
      {error && <p className="text-sm text-brand-500">{error}</p>}
      <button type="submit" disabled={isSubmitting} className={submitClass}>
        {isSubmitting ? AUTH_COPY.login.submitting : AUTH_COPY.login.submit}
      </button>
    </form>
  );
}

function RegisterForm({ onSuccess }: { onSuccess: () => void }) {
  const registerFn = useAuth((s) => s.register);
  const isSubmitting = useAuth((s) => s.isSubmitting);
  const error = useAuth((s) => s.error);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });

  const onSubmit = handleSubmit(async (values) => {
    await registerFn(values);
    if (useAuth.getState().user) onSuccess();
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field
        label={AUTH_COPY.register.fields.name.label}
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
        label={AUTH_COPY.register.fields.phone.label}
        required
        error={errors.phone?.message}
      >
        <input
          type="tel"
          autoComplete="tel"
          placeholder={AUTH_COPY.register.fields.phone.placeholder}
          aria-required="true"
          className={inputClass}
          {...register("phone")}
        />
      </Field>
      <Field
        label={AUTH_COPY.register.fields.email.label}
        error={errors.email?.message}
        hint={AUTH_COPY.register.fields.email.hint}
      >
        <input
          type="email"
          autoComplete="email"
          className={inputClass}
          {...register("email")}
        />
      </Field>
      <Field
        label={AUTH_COPY.register.fields.password.label}
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
      {error && <p className="text-sm text-brand-500">{error}</p>}
      <button type="submit" disabled={isSubmitting} className={submitClass}>
        {isSubmitting
          ? AUTH_COPY.register.submitting
          : AUTH_COPY.register.submit}
      </button>
    </form>
  );
}
