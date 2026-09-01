import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

function digits(phone: string): string {
  const raw = phone.replace(/\D/g, "");
  if (raw.length === 10) return `91${raw}`;
  return raw;
}

export function isWhatsAppConfigured(): boolean {
  return Boolean(env.WHATSAPP_ACCESS_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID);
}

/** Recipients from env (comma-separated). Empty until WhatsApp is wired. */
export function staffWhatsAppFromEnv(): string[] {
  const raw = env.WHATSAPP_STAFF_TO?.trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((p) => digits(p.trim()))
    .filter((p) => p.length >= 10);
}

/**
 * Sends a WhatsApp text to the bakery staff numbers.
 * No-ops (with a log) until WHATSAPP_ACCESS_TOKEN + PHONE_NUMBER_ID are set.
 * Production Meta apps usually need an approved template; this uses session
 * text so local/dev works once a number has messaged the business first.
 */
export async function sendStaffWhatsApp(
  body: string,
  extraPhones: string[] = [],
): Promise<void> {
  const to = [
    ...new Set([...staffWhatsAppFromEnv(), ...extraPhones.map(digits)]),
  ].filter(Boolean);

  if (!isWhatsAppConfigured()) {
    logger.info(
      { to, preview: body.slice(0, 160) },
      "whatsapp skipped (WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID not set)",
    );
    return;
  }

  if (to.length === 0) {
    logger.warn(
      "whatsapp skipped — no staff number (set WHATSAPP_STAFF_TO or BusinessSettings.supportPhone)",
    );
    return;
  }

  const url = `https://graph.facebook.com/v21.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

  await Promise.all(
    to.map(async (phone) => {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: phone,
            type: "text",
            text: { body, preview_url: false },
          }),
        });
        if (!res.ok) {
          const detail = await res.text().catch(() => "");
          logger.error(
            { phone, status: res.status, detail },
            "whatsapp send failed",
          );
          return;
        }
        logger.info({ phone }, "whatsapp sent");
      } catch (err) {
        logger.error({ err, phone }, "whatsapp send failed");
      }
    }),
  );
}
