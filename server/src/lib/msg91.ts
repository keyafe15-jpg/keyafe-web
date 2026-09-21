import { env } from "../config/env.js";
import { normalizeCustomerPhone } from "./phone.js";
import { logger } from "../utils/logger.js";

export type SendOtpSmsResult = { ok: true; skipped?: boolean } | { ok: false; error: string };

/** True when all MSG91 OTP credentials are present. */
export function isMsg91Configured(): boolean {
  return Boolean(env.MSG91_AUTH_KEY && env.MSG91_SENDER_ID && env.MSG91_OTP_TEMPLATE_ID);
}

/** Indian 10-digit mobile after normalizeCustomerPhone. */
export function isIndianMobile(phone: string): boolean {
  const normalized = normalizeCustomerPhone(phone);
  return /^[6-9]\d{9}$/.test(normalized);
}

/** MSG91 expects country code + number with no plus, e.g. 919876543210. */
export function toMsg91Mobile(phone: string): string | null {
  if (!isIndianMobile(phone)) return null;
  return `91${normalizeCustomerPhone(phone)}`;
}

/**
 * Sends our generated OTP via MSG91 Send OTP API.
 * We keep verification in-app; MSG91 is delivery only.
 */
export async function sendOtpSms(phone: string, otp: string): Promise<SendOtpSmsResult> {
  if (!isMsg91Configured()) {
    logger.info({ phone }, "msg91 not configured — OTP SMS skipped");
    return { ok: true, skipped: true };
  }

  const mobile = toMsg91Mobile(phone);
  if (!mobile) {
    return { ok: false, error: "OTP SMS is only available for Indian mobile numbers right now" };
  }

  const url = new URL("https://control.msg91.com/api/v5/otp");
  url.searchParams.set("template_id", env.MSG91_OTP_TEMPLATE_ID!);
  url.searchParams.set("mobile", mobile);
  url.searchParams.set("authkey", env.MSG91_AUTH_KEY!);
  url.searchParams.set("otp", otp);
  url.searchParams.set("otp_length", "6");
  url.searchParams.set("otp_expiry", "5");
  url.searchParams.set("realTimeResponse", "1");
  if (env.MSG91_SENDER_ID) {
    url.searchParams.set("sender", env.MSG91_SENDER_ID);
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authkey: env.MSG91_AUTH_KEY!,
      },
      // ##OTP## in the template is filled from the otp query param; body mirrors it.
      body: JSON.stringify({ OTP: otp }),
    });

    const rawText = await res.text();
    let payload: { type?: string; message?: string; request_id?: string } = {};
    try {
      payload = rawText ? (JSON.parse(rawText) as typeof payload) : {};
    } catch {
      payload = { message: rawText.slice(0, 200) };
    }

    if (!res.ok || payload.type === "error") {
      const detail = payload.message ?? `HTTP ${res.status}`;
      logger.error(
        { phone: mobile, status: res.status, detail, requestId: payload.request_id },
        "msg91 OTP send failed",
      );
      return { ok: false, error: "Unable to send OTP SMS. Please try again shortly." };
    }

    logger.info(
      { phone: mobile, type: payload.type, requestId: payload.request_id, message: payload.message },
      "msg91 OTP accepted",
    );
    return { ok: true };
  } catch (err) {
    logger.error({ err, phone: mobile }, "msg91 OTP send failed");
    return { ok: false, error: "Unable to send OTP SMS. Please try again shortly." };
  }
}
