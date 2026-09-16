import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../../config/env.js";
import { logger } from "../../utils/logger.js";

export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
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
// Never throws, so fire-and-forget callers don't need to catch. Returns whether
// the message actually went out, for the few callers (e.g. the admin "Email
// invoice" button) that need to report success back to a human.
export async function sendEmail(input: SendEmailInput): Promise<boolean> {
  const recipients = Array.isArray(input.to) ? input.to : [input.to];
  const attachments = input.attachments ?? [];
  const tx = getTransporter();

  if (!tx) {
    logger.info(
      {
        to: recipients,
        subject: input.subject,
        attachments: attachments.map((a) => a.filename),
      },
      "email skipped (SMTP_USER/SMTP_PASS not set) — printing preview",
    );
    return false;
  }

  try {
    const info = await tx.sendMail({
      from: env.EMAIL_FROM,
      to: recipients,
      subject: input.subject,
      html: input.html,
      ...(input.replyTo ? { replyTo: input.replyTo } : {}),
      ...(attachments.length
        ? {
            attachments: attachments.map((a) => ({
              filename: a.filename,
              content: a.content,
              contentType: a.contentType ?? "application/octet-stream",
            })),
          }
        : {}),
    });
    logger.info(
      {
        messageId: info.messageId,
        to: recipients,
        subject: input.subject,
        attachments: attachments.map((a) => a.filename),
      },
      "email sent",
    );
    return true;
  } catch (err) {
    logger.error(
      { err, to: recipients, subject: input.subject },
      "SMTP send failed",
    );
    return false;
  }
}
