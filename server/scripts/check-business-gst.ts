// Exercises the Business & GST settings endpoints against the real Express app,
// including the staff auth guard, the zod validation and the GSTIN/state
// cross-check. Restores the original settings row afterwards.
//
// DEV DATABASE ONLY. Run: ./node_modules/.bin/tsx scripts/check-business-gst.ts
import type { AddressInfo } from "node:net";
import jwt from "jsonwebtoken";
import { createApp } from "../src/app.js";
import { prisma } from "../src/config/db.js";
import { env } from "../src/config/env.js";

let failures = 0;
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

async function main() {
  const original = await prisma.businessSettings.findFirstOrThrow();

  // A staff account that actually holds settings.update, so the guard is
  // satisfied the same way a real admin session would satisfy it.
  const staff = await prisma.user.findFirst({
    where: {
      isActive: true,
      role: {
        OR: [
          { isSuperuser: true },
          { permissions: { some: { permission: { key: "settings.update" } } } },
        ],
      },
    },
    select: { id: true, phone: true, role: { select: { slug: true } } },
  });
  if (!staff) {
    throw new Error("no staff user with settings.update in the dev DB");
  }
  console.log(`Authenticating as staff role "${staff.role?.slug}"\n`);

  // And a staff account without it, to prove the permission gate bites rather
  // than merely the staff gate.
  const limitedStaff = await prisma.user.findFirst({
    where: {
      isActive: true,
      role: {
        isSuperuser: false,
        slug: { not: "customer" },
        permissions: { none: { permission: { key: "settings.update" } } },
      },
    },
    select: { id: true, phone: true, role: { select: { slug: true } } },
  });

  const mintToken = (user: { id: string; phone: string }) =>
    jwt.sign(
      { sub: user.id, type: "access", phone: user.phone },
      env.JWT_SECRET,
      { expiresIn: "10m" },
    );
  const token = mintToken(staff);

  const app = createApp();
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const { port } = server.address() as AddressInfo;
  const base = `http://127.0.0.1:${port}/api/admin/business/gst`;

  const call = async (
    method: "GET" | "PATCH",
    body?: unknown,
    auth: string | null = token,
  ) => {
    const res = await fetch(base, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const text = await res.text();
    let json: unknown = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = text;
    }
    return { status: res.status, body: json as Record<string, unknown> };
  };

  try {
    // 1. Business identity must not be readable without staff auth, nor by
    // staff who lack settings.update.
    const anon = await call("GET", undefined, null);
    check("GET without auth is refused", anon.status, 401);

    if (limitedStaff) {
      const limited = await call("GET", undefined, mintToken(limitedStaff));
      check(
        `GET as "${limitedStaff.role?.slug}" (no settings.update) is refused`,
        limited.status,
        403,
      );
    }

    // 2. Authenticated read returns the current settings.
    const read = await call("GET");
    check("GET with staff auth succeeds", read.status, 200);
    check("GET returns legalName", read.body.legalName, original.legalName);

    const goodPayload = {
      legalName: "Keyafe Foods",
      tradeName: "Keyafe",
      // West Bengal GSTIN (starts 19) matching the address below.
      gstin: "19AAACR5055K1Z4",
      gstScheme: "REGULAR",
      registeredAddress: {
        line1: "12A Grand Trunk Road",
        line2: "Belur",
        city: "Howrah",
        state: "West Bengal",
        stateCode: "19",
        pincode: "711202",
      },
      invoicePrefix: "key",
      fyStartMonth: 4,
      challanTerms:
        "Goods once delivered will not be taken back. Please check quantity before signing.",
    };

    // Confirm the GSTIN used above is genuinely valid before relying on it.
    const { gstinIssue } = await import("../src/lib/gstin.js");
    check("test GSTIN is valid", gstinIssue(goodPayload.gstin), null);

    // 3. Happy path, including prefix upper-casing.
    const saved = await call("PATCH", goodPayload);
    check("PATCH valid payload succeeds", saved.status, 200);
    check("gstin saved", saved.body.gstin, "19AAACR5055K1Z4");
    check("invoicePrefix upper-cased", saved.body.invoicePrefix, "KEY");
    check(
      "challan terms saved",
      saved.body.challanTerms,
      goodPayload.challanTerms,
    );

    // Blank terms must collapse to null, so the challan omits the box rather
    // than printing an empty heading.
    const blankTerms = await call("PATCH", {
      ...goodPayload,
      challanTerms: "   ",
    });
    check("blank terms accepted", blankTerms.status, 200);
    check("blank terms stored as null", blankTerms.body.challanTerms, null);

    // 4. A GSTIN whose state disagrees with the registered address is refused.
    const mismatch = await call("PATCH", {
      ...goodPayload,
      gstin: "27AAACR5055K1Z7", // Maharashtra
    });
    check("GSTIN/address state mismatch refused", mismatch.status, 400);
    console.log(`        ${String(mismatch.body.error ?? "")}`);

    // 5. Bad checksum refused.
    const badChecksum = await call("PATCH", {
      ...goodPayload,
      gstin: "19AAACR5055K1Z5", // correct digit is 4
    });
    check("bad checksum refused", badChecksum.status, 400);

    // 6. Blank GSTIN is allowed — unregistered sellers issue plain invoices.
    const cleared = await call("PATCH", { ...goodPayload, gstin: "" });
    check("blank gstin accepted", cleared.status, 200);
    check("blank gstin stored as null", cleared.body.gstin, null);

    // 7. Rubbish prefix refused.
    const badPrefix = await call("PATCH", {
      ...goodPayload,
      invoicePrefix: "KEY/26",
    });
    check("prefix with slash refused", badPrefix.status, 400);

    // 8. A half-filled address is refused — all of it prints on the invoice.
    const noCity = await call("PATCH", {
      ...goodPayload,
      registeredAddress: { ...goodPayload.registeredAddress, city: "" },
    });
    check("address without city refused", noCity.status, 400);

    // 9. GET always returns a bindable address object, even when unset.
    await prisma.businessSettings.update({
      where: { id: original.id },
      data: { registeredAddress: {} },
    });
    const emptyAddr = await call("GET");
    check("GET fills in a blank address shape", emptyAddr.status, 200);
    check(
      "blank address has all keys",
      Object.keys(
        (emptyAddr.body.registeredAddress as Record<string, unknown>) ?? {},
      ).sort(),
      ["city", "line1", "line2", "pincode", "state", "stateCode"],
    );
  } finally {
    server.close();
    // Put the row back exactly as it was.
    await prisma.businessSettings.update({
      where: { id: original.id },
      data: {
        legalName: original.legalName,
        tradeName: original.tradeName,
        gstin: original.gstin,
        gstScheme: original.gstScheme,
        registeredAddress: original.registeredAddress ?? {},
        invoicePrefix: original.invoicePrefix,
        fyStartMonth: original.fyStartMonth,
      },
    });
    console.log("\nRestored the original BusinessSettings row");
  }
}

main()
  .catch((err) => {
    failures++;
    console.error("script error:", err);
  })
  .finally(async () => {
    console.log(
      failures === 0 ? "All checks passed" : `${failures} check(s) FAILED`,
    );
    await prisma.$disconnect();
    process.exit(failures === 0 ? 0 : 1);
  });
