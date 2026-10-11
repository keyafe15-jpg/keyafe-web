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

/** Meta body params reject newlines and long runs of spaces. */
export function waText(value: string): string {
  const cleaned = value
    .replace(/[\r\n\t]+/g, " ")
    .replace(/ {2,}/g, " ")
    .trim();
  return cleaned || "-";
}

export function staffWhatsAppRecipients(extraPhones: string[] = []): string[] {
  return [...new Set([...staffWhatsAppFromEnv(), ...extraPhones.map(digits)])].filter(Boolean);
}

type TemplateComponent =
  | {
      type: "body";
      parameters: { type: "text"; text: string }[];
    }
  | {
      type: "button";
      sub_type: "url";
      index: "0";
      parameters: { type: "text"; text: string }[];
    };

/**
 * Sends an approved Cloud API template. No-ops (with a log) until the token
 * and phone-number id are set. Failures are logged and never thrown.
 *
 * Never pass `order.deliveryPhone` when `order.isSurpriseGift` is true —
 * notify the buyer (`customerPhone`) only.
 */
export async function sendWhatsAppTemplate(args: {
  to: string | string[];
  template: string;
  bodyParams: string[];
  buttonUrlSuffix?: string;
}): Promise<void> {
  const to = [...new Set((Array.isArray(args.to) ? args.to : [args.to]).map(digits))].filter(
    (p) => p.length >= 10,
  );

  if (!isWhatsAppConfigured()) {
    logger.info(
      { to, template: args.template, preview: args.bodyParams.join(" · ").slice(0, 160) },
      "whatsapp skipped (WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID not set)",
    );
    return;
  }

  if (to.length === 0) {
    logger.warn({ template: args.template }, "whatsapp skipped — no recipient");
    return;
  }

  const components: TemplateComponent[] = [
    {
      type: "body",
      parameters: args.bodyParams.map((text) => ({ type: "text", text: waText(text) })),
    },
  ];
  if (args.buttonUrlSuffix) {
    components.push({
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: [{ type: "text", text: waText(args.buttonUrlSuffix) }],
    });
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
            type: "template",
            template: {
              name: args.template,
              language: { code: env.WHATSAPP_TEMPLATE_LANG },
              components,
            },
          }),
        });
        if (!res.ok) {
          const detail = await res.text().catch(() => "");
          logger.error(
            { phone, status: res.status, detail, template: args.template },
            "whatsapp send failed",
          );
          return;
        }
        logger.info({ phone, template: args.template }, "whatsapp sent");
      } catch (err) {
        logger.error({ err, phone, template: args.template }, "whatsapp send failed");
      }
    }),
  );
}
