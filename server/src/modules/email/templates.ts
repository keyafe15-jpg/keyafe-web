import type { Order, OrderItem } from "@prisma/client";

type OrderWithItems = Order & { items: OrderItem[] };

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function money(v: unknown): string {
  const n = typeof v === "number" ? v : Number(v);
  return `₹${n.toFixed(2)}`;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function itemRow(item: OrderItem): string {
  const meta = [item.sizeLabel, item.flavourName].filter(Boolean).join(" · ");
  return `
    <tr>
      <td style="padding:12px 0;border-top:1px solid #f0e6d5;">
        <div style="font-weight:600;color:#2c3540;">${escapeHtml(item.productName)}</div>
        ${meta ? `<div style="font-size:13px;color:#7d8590;">${escapeHtml(meta)}</div>` : ""}
        ${
          item.messageOnCake
            ? `<div style="font-size:13px;color:#7d8590;font-style:italic;">"${escapeHtml(item.messageOnCake)}"</div>`
            : ""
        }
        <div style="font-size:12px;color:#e31c79;font-weight:600;margin-top:4px;">
          ${
            item.deliveryDate && item.deliverySlotLabel
              ? `${escapeHtml(formatDate(item.deliveryDate))} · ${escapeHtml(item.deliverySlotLabel)}`
              : "Ships pan-India via courier"
          }
        </div>
      </td>
      <td style="padding:12px 0;border-top:1px solid #f0e6d5;text-align:right;vertical-align:top;">
        <div style="font-size:13px;color:#7d8590;">Qty ${item.qty}</div>
        <div style="font-weight:600;color:#2c3540;">${money(item.lineTotal)}</div>
      </td>
    </tr>`;
}

function addressBlock(order: OrderWithItems): string {
  const addr = order.deliveryAddress as null | {
    line1: string;
    line2?: string | null;
    landmark?: string | null;
    mapSearchQuery?: string | null;
    pincode: string;
    city?: string | null;
    area?: string | null;
  };
  if (order.fulfillment === "PICKUP" || !addr) {
    return `<p style="margin:0;color:#2c3540;">Pickup at the bakery — Howrah 711202</p>`;
  }
  return `
    <div style="color:#2c3540;">
      <div style="font-weight:600;">${escapeHtml(order.customerName)}</div>
      <div>${escapeHtml(addr.line1)}</div>
      ${addr.line2 ? `<div>${escapeHtml(addr.line2)}</div>` : ""}
      ${addr.landmark ? `<div style="color:#7d8590;">Near ${escapeHtml(addr.landmark)}</div>` : ""}
      <div>${escapeHtml([addr.area, addr.city].filter(Boolean).join(", "))} ${escapeHtml(addr.pincode)}</div>
      <div style="color:#7d8590;margin-top:4px;">${escapeHtml(order.customerPhone)}</div>
      ${
        addr.mapSearchQuery
          ? `<div style="margin-top:10px;padding:8px 12px;background:#fdeaf3;border-left:3px solid #e31c79;border-radius:4px;">
              <div style="font-size:10px;color:#e31c79;font-weight:700;letter-spacing:0.5px;">SEARCH ON UBER / RAPIDO</div>
              <div style="color:#2c3540;font-weight:600;margin-top:2px;">${escapeHtml(addr.mapSearchQuery)}</div>
            </div>`
          : ""
      }
    </div>`;
}

function shell(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:#faf6ec;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#2c3540;">
  <div style="max-width:600px;margin:0 auto;padding:32px 20px;">
    <div style="background:#ffffff;border:1px solid #f0e6d5;border-radius:12px;padding:24px;">
      ${bodyHtml}
    </div>
    <p style="text-align:center;color:#7d8590;font-size:12px;margin-top:24px;">
      Keyafe Bakery · Howrah 711202 · +91 93300 48665
    </p>
  </div>
</body></html>`;
}

// Aggregated totals rows including the CGST+SGST / IGST breakup. Bakery is
// GST-inclusive by default so `taxableAmount + gst = subtotal`.
function totalsBlock(order: OrderWithItems): string {
  const cgst = Number(order.cgstAmount);
  const sgst = Number(order.sgstAmount);
  const igst = Number(order.igstAmount);
  const taxable = Number(order.taxableAmount);
  const hasIntraGst = cgst > 0 || sgst > 0;
  const hasInterGst = igst > 0;
  const row = (label: string, value: string, small = true) => `
    <tr>
      <td style="padding:4px 0;font-size:${small ? "13px" : "14px"};color:#7d8590;">${label}</td>
      <td style="padding:4px 0;font-size:${small ? "13px" : "14px"};text-align:right;color:#2c3540;">${value}</td>
    </tr>`;
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:16px;border-top:2px solid #2c3540;padding-top:8px;">
      ${row("Taxable amount", money(taxable))}
      ${hasIntraGst ? row("CGST", money(cgst)) : ""}
      ${hasIntraGst ? row("SGST", money(sgst)) : ""}
      ${hasInterGst ? row("IGST", money(igst)) : ""}
      ${row("Subtotal (incl. GST)", money(order.subtotal))}
      ${
        order.fulfillment === "DELIVERY"
          ? row("Delivery", money(order.deliveryFee))
          : ""
      }
      <tr>
        <td style="padding:12px 0 0;font-weight:600;border-top:1px solid #f0e6d5;">Total</td>
        <td style="padding:12px 0 0;font-weight:700;font-size:18px;text-align:right;border-top:1px solid #f0e6d5;">${money(order.total)}</td>
      </tr>
    </table>`;
}

export function renderCustomerConfirmation(order: OrderWithItems) {
  const rows = order.items.map(itemRow).join("");
  const html = shell(
    `Order confirmed — ${order.orderNumber}`,
    `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
      <span style="display:inline-block;padding:4px 10px;background:#e6f6ec;color:#0f6b30;border-radius:999px;font-size:11px;font-weight:600;letter-spacing:0.4px;">ORDER CONFIRMED</span>
      <span style="font-family:monospace;color:#7d8590;font-size:13px;">${escapeHtml(order.orderNumber)}</span>
    </div>
    <h1 style="margin:6px 0 4px;font-size:24px;color:#2c3540;">Thank you, ${escapeHtml(order.customerName.split(" ")[0] ?? order.customerName)}!</h1>
    <p style="margin:0 0 20px;color:#7d8590;">
      We've received your order and started preparing. You'll get another note when it's on the way.
    </p>

    <h3 style="margin:20px 0 6px;font-size:13px;color:#7d8590;text-transform:uppercase;letter-spacing:0.5px;">
      ${order.fulfillment === "DELIVERY" ? "Delivery to" : "Pickup at"}
    </h3>
    ${addressBlock(order)}

    <h3 style="margin:24px 0 6px;font-size:13px;color:#7d8590;text-transform:uppercase;letter-spacing:0.5px;">Your order</h3>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
      ${rows}
    </table>

    ${totalsBlock(order)}
    <p style="color:#7d8590;font-size:12px;margin-top:10px;">
      Payment: ${escapeHtml(order.paymentMethod.toUpperCase())} · ${escapeHtml(order.paymentStatus)}
    </p>

    ${
      order.customerNotes
        ? `<p style="margin-top:20px;padding:12px;background:#faf6ec;border-radius:6px;color:#2c3540;font-size:13px;">
            <strong>Your notes:</strong><br>${escapeHtml(order.customerNotes)}
          </p>`
        : ""
    }

    <p style="margin-top:24px;color:#7d8590;font-size:13px;">
      Questions? Just reply to this email or call us at
      <a href="tel:+919330048665" style="color:#e31c79;text-decoration:none;">+91 93300 48665</a>.
    </p>`,
  );
  return {
    subject: `Order confirmed — ${order.orderNumber}`,
    html,
  };
}

export function renderAdminNotification(order: OrderWithItems) {
  const rows = order.items.map(itemRow).join("");
  const html = shell(
    `New order — ${order.orderNumber}`,
    `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
      <span style="display:inline-block;padding:4px 10px;background:#fdeaf3;color:#e31c79;border-radius:999px;font-size:11px;font-weight:600;letter-spacing:0.4px;">NEW ORDER</span>
      <span style="font-family:monospace;color:#7d8590;font-size:13px;">${escapeHtml(order.orderNumber)}</span>
    </div>
    <h1 style="margin:6px 0 4px;font-size:22px;color:#2c3540;">${money(order.total)} · ${escapeHtml(order.customerName)}</h1>
    <p style="margin:0 0 20px;color:#7d8590;">
      Placed at ${escapeHtml(order.createdAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }))}
    </p>

    <h3 style="margin:20px 0 6px;font-size:13px;color:#7d8590;text-transform:uppercase;letter-spacing:0.5px;">
      Customer
    </h3>
    <div style="color:#2c3540;">
      <div><strong>${escapeHtml(order.customerName)}</strong></div>
      <div><a href="tel:${escapeHtml(order.customerPhone)}" style="color:#e31c79;text-decoration:none;">${escapeHtml(order.customerPhone)}</a></div>
      ${order.customerEmail ? `<div><a href="mailto:${escapeHtml(order.customerEmail)}" style="color:#e31c79;text-decoration:none;">${escapeHtml(order.customerEmail)}</a></div>` : ""}
    </div>

    <h3 style="margin:20px 0 6px;font-size:13px;color:#7d8590;text-transform:uppercase;letter-spacing:0.5px;">
      ${order.fulfillment === "DELIVERY" ? "Delivery to" : "Pickup"}
    </h3>
    ${addressBlock(order)}

    <h3 style="margin:24px 0 6px;font-size:13px;color:#7d8590;text-transform:uppercase;letter-spacing:0.5px;">Items</h3>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
      ${rows}
    </table>

    ${totalsBlock(order)}

    ${
      order.customerNotes
        ? `<p style="margin-top:20px;padding:12px;background:#faf6ec;border-radius:6px;color:#2c3540;font-size:13px;">
            <strong>Customer notes:</strong><br>${escapeHtml(order.customerNotes)}
          </p>`
        : ""
    }`,
  );
  return {
    subject: `New order · ${money(order.total)} · ${order.customerName} · ${order.orderNumber}`,
    html,
  };
}
