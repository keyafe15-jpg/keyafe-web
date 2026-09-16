// Checks the admin invoice routes: the invoices.read gate, the PDF download
// and the email endpoint.
//
// DEV DATABASE ONLY. Creates and deletes a probe order, and rewinds the
// invoice counter it consumes.
//
// Run: ./node_modules/.bin/tsx scripts/check-invoice-routes.ts
import type { AddressInfo } from "node:net";
import jwt from "jsonwebtoken";
import { createApp } from "../src/app.js";
import { prisma } from "../src/config/db.js";
import { env } from "../src/config/env.js";
import { createOrder, createOrderSchema } from "../src/modules/orders/order.service.js";
import { financialYearLabel } from "../src/modules/orders/invoice.service.js";

const PROBE_PHONE = "9999000003";
const PROBE_NAME = "Route Probe";

let failures = 0;
const created: string[] = [];

function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(
    `${ok ? "ok  " : "FAIL"}  ${label}` +
      (ok
        ? ""
        : `\n        got ${JSON.stringify(actual)}\n        want ${JSON.stringify(expected)}`),
  );
}

let restore: { series: string; counterBefore: number | null } | null = null;

async function main() {
  const clash = await prisma.user.findFirst({
    where: { phone: { contains: PROBE_PHONE } },
    select: { name: true },
  });
  if (clash && !clash.name.startsWith(PROBE_NAME)) {
    throw new Error(`PROBE_PHONE ${PROBE_PHONE} belongs to "${clash.name}"`);
  }

  const settings = await prisma.businessSettings.findFirstOrThrow();
  const series = `${settings.invoicePrefix}/${financialYearLabel(new Date(), settings.fyStartMonth)}`;
  const counterBefore = await prisma.invoiceCounter.findUnique({ where: { series } });
  restore = { series, counterBefore: counterBefore?.lastNumber ?? null };

  const superuser = await prisma.user.findFirstOrThrow({
    where: { isActive: true, role: { isSuperuser: true } },
    select: { id: true, phone: true, role: { select: { slug: true } } },
  });
  // A staff account without invoices.read — the chef role, by default.
  const limited = await prisma.user.findFirst({
    where: {
      isActive: true,
      role: {
        isSuperuser: false,
        slug: { not: "customer" },
        permissions: { none: { permission: { key: "invoices.read" } } },
      },
    },
    select: { id: true, phone: true, role: { select: { slug: true } } },
  });

  const mint = (u: { id: string; phone: string }) =>
    jwt.sign({ sub: u.id, type: "access", phone: u.phone }, env.JWT_SECRET, {
      expiresIn: "10m",
    });
  const adminToken = mint(superuser);

  const product = await prisma.product.findFirstOrThrow({
    where: { isActive: true, isAvailable: true, canBeDeliveredPanIndia: false },
  });
  const pin = await prisma.deliveryPincode.findFirstOrThrow({ where: { isActive: true } });

  const order = await createOrder(
    createOrderSchema.parse({
      customerName: PROBE_NAME,
      customerPhone: PROBE_PHONE,
      // No email, so the "cannot email" branch can be checked first.
      customerEmail: null,
      fulfillment: "DELIVERY",
      deliveryAddress: {
        line1: "1 Test Lane",
        line2: null,
        landmark: null,
        mapSearchQuery: "Test Lane landmark",
        pincode: pin.pincode,
        city: null,
        area: null,
        state: "West Bengal",
        stateCode: "19",
      },
      customerNotes: "automated route check",
      paymentMethod: "cod",
      couponCode: null,
      items: [{ productId: product.id, unitPrice: 1000, qty: 1 }],
    }),
  );
  created.push(order.id);

  const app = createApp();
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const { port } = server.address() as AddressInfo;
  const base = `http://127.0.0.1:${port}/api/admin/orders/${order.id}`;

  try {
    console.log(`\n-- permission gate (signed in as "${superuser.role?.slug}")`);
    const anon = await fetch(`${base}/invoice`);
    check("download without auth is refused", anon.status, 401);

    if (limited) {
      const res = await fetch(`${base}/invoice`, {
        headers: { Authorization: `Bearer ${mint(limited)}` },
      });
      check(
        `download as "${limited.role?.slug}" (no invoices.read) is refused`,
        res.status,
        403,
      );
    } else {
      console.log("        (no limited-permission staff account to test with)");
    }

    console.log("\n-- pdf download");
    const dl = await fetch(`${base}/invoice`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    check("download succeeds", dl.status, 200);
    check("content type is pdf", dl.headers.get("content-type"), "application/pdf");

    const invoiceNumber = dl.headers.get("x-invoice-number");
    check("invoice number header is set", Boolean(invoiceNumber), true);
    const disposition = dl.headers.get("content-disposition") ?? "";
    check("is sent as an attachment", disposition.startsWith("attachment;"), true);
    check(
      "filename has no slashes",
      /filename="[A-Za-z0-9.\-]+"/.test(disposition),
      true,
    );
    check(
      "both headers are exposed to the browser",
      (dl.headers.get("access-control-expose-headers") ?? "").toLowerCase(),
      "content-disposition,x-invoice-number",
    );

    const body = Buffer.from(await dl.arrayBuffer());
    check("body is a PDF", body.subarray(0, 5).toString(), "%PDF-");
    check(
      "content-length matches the body",
      Number(dl.headers.get("content-length")),
      body.length,
    );
    console.log(`        ${invoiceNumber} · ${body.length} bytes`);

    // Downloading again must not mint a second number.
    const dl2 = await fetch(`${base}/invoice`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    check(
      "second download reuses the number",
      dl2.headers.get("x-invoice-number"),
      invoiceNumber,
    );

    console.log("\n-- email endpoint");
    const noEmail = await fetch(`${base}/invoice/email`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    check("refuses when the order has no email", noEmail.status, 400);
    const noEmailBody = (await noEmail.json()) as { error?: string };
    console.log(`        ${noEmailBody.error}`);

    // Addressed to the bakery's own support inbox rather than a made-up
    // address: if SMTP is live this really does send, and mail to a fake
    // domain would bounce and chip away at sender reputation.
    const probeRecipient = settings.supportEmail;
    await prisma.order.update({
      where: { id: order.id },
      data: { customerEmail: probeRecipient },
    });
    const emailed = await fetch(`${base}/invoice/email`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    check("accepts once an email exists", emailed.status, 200);
    const result = (await emailed.json()) as {
      sent: boolean;
      to: string;
      invoiceNumber: string;
    };
    check("reports the recipient", result.to, probeRecipient);
    check("reuses the same invoice number", result.invoiceNumber, invoiceNumber);
    console.log(
      result.sent
        ? `        actually sent to ${probeRecipient} — check that inbox for the PDF attachment`
        : `        not sent (SMTP_USER/SMTP_PASS not configured), which is the expected dev state`,
    );

    console.log("\n-- cancelled orders");
    await prisma.order.update({
      where: { id: order.id },
      data: { status: "CANCELLED", invoiceNumber: null, invoiceDate: null },
    });
    const cancelled = await fetch(`${base}/invoice`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    check("cancelled order is refused", cancelled.status, 400);
    const cancelledBody = (await cancelled.json()) as { error?: string };
    console.log(`        ${cancelledBody.error}`);
  } finally {
    server.close();
  }
}

main()
  .catch((err) => {
    failures++;
    console.error("\nscript error:", err);
  })
  .finally(async () => {
    if (restore) {
      if (restore.counterBefore === null) {
        await prisma.invoiceCounter.deleteMany({ where: { series: restore.series } });
      } else {
        await prisma.invoiceCounter.updateMany({
          where: { series: restore.series },
          data: { lastNumber: restore.counterBefore },
        });
      }
      console.log(`\nRestored the ${restore.series} counter`);
    }
    for (const id of created) {
      await prisma.orderItem.deleteMany({ where: { orderId: id } });
      await prisma.order.delete({ where: { id } });
    }
    const { count } = await prisma.user.deleteMany({
      where: { phone: { contains: PROBE_PHONE }, name: { startsWith: PROBE_NAME } },
    });
    console.log(`Cleaned up ${created.length} probe order(s) and ${count} profile(s)`);
    console.log(failures === 0 ? "\nAll checks passed" : `\n${failures} check(s) FAILED`);
    await prisma.$disconnect();
    process.exit(failures === 0 ? 0 : 1);
  });
