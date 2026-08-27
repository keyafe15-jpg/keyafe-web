import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../../config/env.js";
import { logger } from "../../utils/logger.js";

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
}

// Lazy-cached transporter — created once when the first email is sent.
let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (transporter) return transporter;
  if (!env.SMTP_USER || !env.SMTP_PASS) return null;
  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });
  logger.info(
    { host: env.SMTP_HOST, port: env.SMTP_PORT, user: env.SMTP_USER },
    "SMTP transporter initialised",
  );
  return transporter;
}

// Sends via SMTP when credentials are configured; otherwise logs.
// Fire-and-forget — never throws so callers don't need to await/catch.
export async function sendEmail(input: SendEmailInput): Promise<void> {
  const recipients = Array.isArray(input.to) ? input.to : [input.to];
  const tx = getTransporter();

  if (!tx) {
    logger.info(
      { to: recipients, subject: input.subject },
      "email skipped (SMTP_USER/SMTP_PASS not set) — printing preview",
    );
    return;
  }

  try {
    const info = await tx.sendMail({
      from: env.EMAIL_FROM,
      to: recipients,
      subject: input.subject,
      html: input.html,
      ...(input.replyTo ? { replyTo: input.replyTo } : {}),
    });
    logger.info(
      { messageId: info.messageId, to: recipients, subject: input.subject },
      "email sent",
    );
  } catch (err) {
    logger.error(
      { err, to: recipients, subject: input.subject },
      "SMTP send failed",
    );
  }
}
