import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAdminAuth } from "@/store/adminAuth";
import { firstAllowedPath } from "@/lib/permissions";
import { cn } from "@/lib/cn";

type Method = "password" | "otp";

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none";
const labelClass = "mb-1 block text-xs font-medium tracking-wide text-slate-500 uppercase";

export function LoginPage() {
  const user = useAdminAuth((s) => s.user);
  const clearError = useAdminAuth((s) => s.clearError);
  const navigate = useNavigate();
  const [method, setMethod] = useState<Method>("password");
  const [phone, setPhone] = useState("");

  if (user) {
    navigate(firstAllowedPath(user), { replace: true });
    return null;
  }

  const onSignedIn = () => {
    navigate(firstAllowedPath(useAdminAuth.getState().user), { replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-sm rounded-card border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-3">
          <img src="/logo.png" alt="Keyafe" className="h-10 w-10 rounded-full" />
          <div>
            <p className="text-sm font-semibold text-slate-900">Keyafe Admin</p>
            <p className="text-xs text-slate-500">Sign in with your staff phone number.</p>
          </div>
        </div>

        <div role="tablist" className="mb-5 grid grid-cols-2 rounded-lg bg-slate-100 p-1">
          {(
            [
              { key: "password", label: "Password" },
              { key: "otp", label: "OTP" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={method === tab.key}
              onClick={() => {
                clearError();
                setMethod(tab.key);
              }}
              className={cn(
                "rounded-md py-1.5 text-sm font-medium transition",
                method === tab.key
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {method === "password" ? (
          <PasswordForm phone={phone} setPhone={setPhone} onSignedIn={onSignedIn} />
        ) : (
          <OtpForm phone={phone} setPhone={setPhone} onSignedIn={onSignedIn} />
        )}
      </div>
    </div>
  );
}

interface FormProps {
  phone: string;
  setPhone: (phone: string) => void;
  onSignedIn: () => void;
}

function PhoneInput({ phone, setPhone }: Pick<FormProps, "phone" | "setPhone">) {
  return (
    <label className="mb-4 block">
      <span className={labelClass}>Phone</span>
      <input
        type="tel"
        autoComplete="username"
        required
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="9876543210"
        className={inputClass}
      />
    </label>
  );
}

function ErrorNote() {
  const error = useAdminAuth((s) => s.error);
  if (!error) return null;
  return <p className="mb-3 rounded-md bg-brand-100 px-3 py-2 text-xs text-brand-700">{error}</p>;
}

function SubmitButton({ busy, children }: { busy: boolean; children: string }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="w-full rounded-lg bg-brand-500 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
    >
      {children}
    </button>
  );
}

function PasswordForm({ phone, setPhone, onSignedIn }: FormProps) {
  const loginWithPassword = useAdminAuth((s) => s.loginWithPassword);
  const requestPasswordReset = useAdminAuth((s) => s.requestPasswordReset);
  const isSubmitting = useAdminAuth((s) => s.isSubmitting);
  const [password, setPassword] = useState("");
  const [resetNote, setResetNote] = useState<string | null>(null);
  const [resetBusy, setResetBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetNote(null);
    if (await loginWithPassword({ phone: phone.trim(), password })) onSignedIn();
  };

  const onForgot = async () => {
    if (!phone.trim()) {
      setResetNote("Enter your phone number first, then tap Forgot password.");
      return;
    }
    setResetBusy(true);
    try {
      const message = await requestPasswordReset(phone.trim());
      setResetNote(`${message} No email on your account? Ask an admin to reset your password.`);
    } catch (err) {
      setResetNote(err instanceof Error ? err.message : "Could not send the reset link");
    } finally {
      setResetBusy(false);
    }
  };

  return (
    <form onSubmit={onSubmit}>
      <PhoneInput phone={phone} setPhone={setPhone} />
      <label className="mb-2 block">
        <span className={labelClass}>Password</span>
        <input
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
        />
      </label>
      <div className="mb-4 text-right">
        <button
          type="button"
          disabled={resetBusy}
          onClick={() => void onForgot()}
          className="text-xs text-brand-600 hover:underline disabled:opacity-60"
        >
          {resetBusy ? "Sending…" : "Forgot password?"}
        </button>
      </div>
      {resetNote && (
        <p className="mb-3 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">{resetNote}</p>
      )}
      <ErrorNote />
      <SubmitButton busy={isSubmitting}>{isSubmitting ? "Signing in…" : "Sign in"}</SubmitButton>
    </form>
  );
}

function OtpForm({ phone, setPhone, onSignedIn }: FormProps) {
  const sendOtp = useAdminAuth((s) => s.sendOtp);
  const verifyOtp = useAdminAuth((s) => s.verifyOtp);
  const isSubmitting = useAdminAuth((s) => s.isSubmitting);
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [otp, setOtp] = useState("");
  const [devOtp, setDevOtp] = useState<string | null>(null);

  const onSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = await sendOtp(phone.trim());
    if (useAdminAuth.getState().error) return;
    setDevOtp(code);
    setStep("otp");
  };

  const onVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await verifyOtp({ phone: phone.trim(), otp: otp.trim() })) onSignedIn();
  };

  return (
    <form onSubmit={step === "phone" ? onSendOtp : onVerify}>
      {step === "phone" ? (
        <PhoneInput phone={phone} setPhone={setPhone} />
      ) : (
        <label className="mb-4 block">
          <span className={labelClass}>OTP sent to {phone}</span>
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            placeholder="6-digit code"
            className={inputClass}
          />
          <button
            type="button"
            className="mt-2 text-xs text-brand-600 hover:underline"
            onClick={() => {
              setStep("phone");
              setOtp("");
              setDevOtp(null);
            }}
          >
            Change number
          </button>
        </label>
      )}

      {devOtp && (
        <p className="mb-3 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
          Dev OTP: <span className="font-mono font-semibold">{devOtp}</span>
        </p>
      )}

      <ErrorNote />
      <SubmitButton busy={isSubmitting}>
        {isSubmitting
          ? step === "phone"
            ? "Sending…"
            : "Verifying…"
          : step === "phone"
            ? "Send OTP"
            : "Verify & sign in"}
      </SubmitButton>
    </form>
  );
}
