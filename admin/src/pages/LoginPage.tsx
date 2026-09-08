import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAdminAuth } from "@/store/adminAuth";
import { firstAllowedPath } from "@/lib/permissions";

export function LoginPage() {
  const sendOtp = useAdminAuth((s) => s.sendOtp);
  const verifyOtp = useAdminAuth((s) => s.verifyOtp);
  const user = useAdminAuth((s) => s.user);
  const error = useAdminAuth((s) => s.error);
  const isSubmitting = useAdminAuth((s) => s.isSubmitting);
  const navigate = useNavigate();

  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [devOtp, setDevOtp] = useState<string | null>(null);

  if (user) {
    navigate(firstAllowedPath(user), { replace: true });
    return null;
  }

  const onSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = await sendOtp(phone.trim());
    if (useAdminAuth.getState().error) return;
    setDevOtp(code);
    setStep("otp");
  };

  const onVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await verifyOtp({ phone: phone.trim(), otp: otp.trim() });
    if (!ok) return;
    const nextUser = useAdminAuth.getState().user;
    navigate(firstAllowedPath(nextUser), { replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <form
        onSubmit={step === "phone" ? onSendOtp : onVerify}
        className="w-full max-w-sm rounded-card border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="mb-6 flex items-center gap-3">
          <img
            src="/logo.png"
            alt="Keyafe"
            className="h-10 w-10 rounded-full"
          />
          <div>
            <p className="text-sm font-semibold text-slate-900">Keyafe Admin</p>
            <p className="text-xs text-slate-500">
              Sign in with your staff phone number.
            </p>
          </div>
        </div>

        {step === "phone" ? (
          <label className="mb-4 block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
              Phone
            </span>
            <input
              type="tel"
              autoComplete="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="9876543210"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </label>
        ) : (
          <label className="mb-4 block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
              OTP sent to {phone}
            </span>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              placeholder="6-digit code"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
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

        {error && (
          <p className="mb-3 rounded-md bg-brand-100 px-3 py-2 text-xs text-brand-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-brand-500 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          {isSubmitting
            ? step === "phone"
              ? "Sending…"
              : "Verifying…"
            : step === "phone"
              ? "Send OTP"
              : "Verify & sign in"}
        </button>
      </form>
    </div>
  );
}
