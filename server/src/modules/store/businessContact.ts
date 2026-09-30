import { prisma } from "../../config/db.js";

/** The bakery's own name and contact details as saved in Admin → Settings. */
export interface BusinessContact {
  legalName: string;
  tradeName: string;
  /** Display form, e.g. "+91 93300 48665". */
  phone: string;
  /** `tel:` target, e.g. "+919330048665". */
  phoneHref: string;
  email: string;
  /** "Howrah 711202" — from the registered address; blank until it is saved. */
  place: string;
}

function tenDigits(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return digits.length === 10 ? digits : null;
}

export function formatPhone(raw: string) {
  const ten = tenDigits(raw);
  if (!ten) return { phone: raw.trim(), phoneHref: raw.replace(/[^\d+]/g, "") };
  return { phone: `+91 ${ten.slice(0, 5)} ${ten.slice(5)}`, phoneHref: `+91${ten}` };
}

/** Indian mobile numbers are stored as their 10 digits; anything else is kept as typed. */
export function normalizePhone(raw: string) {
  return tenDigits(raw) ?? raw.trim();
}

export async function getBusinessContact(): Promise<BusinessContact> {
  const settings = await prisma.businessSettings.findFirst({
    select: {
      legalName: true,
      tradeName: true,
      supportPhone: true,
      supportEmail: true,
      registeredAddress: true,
    },
  });
  const address = (settings?.registeredAddress ?? {}) as { city?: string; pincode?: string };
  return {
    legalName: settings?.legalName || "Keyafe Foods",
    tradeName: settings?.tradeName || "Keyafe",
    ...formatPhone(settings?.supportPhone ?? ""),
    email: settings?.supportEmail ?? "",
    place: [address.city, address.pincode].filter(Boolean).join(" "),
  };
}
