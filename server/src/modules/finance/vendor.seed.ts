import { prisma } from "../../config/db.js";
import { normalizeCustomerPhone } from "../../lib/phone.js";
import { logger } from "../../utils/logger.js";

/** First shop list from Keyafe's Excel — packaging, toppers, a few kitchens. */
const VENDOR_SEED: {
  name: string;
  phone: string;
  altPhone?: string;
  contact?: string;
  address?: string;
  extra?: string;
  supplies: string[];
}[] = [
  { name: "Oendila Adak", phone: "8672737921", address: "Sodepur", supplies: [] },
  {
    name: "Bake Kraft",
    phone: "7003493754",
    contact: "Ritali Pal",
    address: "Ezra Street",
    supplies: ["packaging"],
  },
  {
    name: "S3 Topper",
    phone: "8910847257",
    contact: "Srinjoy",
    address: "Bhadrakali",
    extra: "Cake toppers",
    supplies: ["toppers"],
  },
  {
    name: "Poushali",
    phone: "9038200556",
    address: "Shyambazar Tram Depot",
    supplies: [],
  },
  {
    name: "S M Icecream Mart",
    phone: "8240737771",
    altPhone: "9833127101",
    contact: "Siddhartha Karnani",
    address: "Bake Kraft, Ezra Street",
    supplies: ["ice-cream"],
  },
  {
    name: "Cake World",
    phone: "6291483882",
    altPhone: "6268982126",
    address: "Dunlop · Bikram Super Market, Shop #42",
    supplies: ["packaging"],
  },
  { name: "Atul Jain", phone: "9831702800", address: "Lake Town", supplies: [] },
  {
    name: "Bake IT",
    phone: "7439966031",
    altPhone: "7003131039",
    address: "839, Silver Orbit, Block-A, behind HDFC Bank",
    supplies: ["packaging"],
  },
  {
    name: "Box Corner",
    phone: "9830011173",
    address: "Surya Sen Street",
    extra: "Cake boxes",
    supplies: ["boxes"],
  },
  {
    name: "Nirav Shah",
    phone: "7021326960",
    extra: "Transparent cake boxes",
    supplies: ["boxes"],
  },
  {
    name: "Swati Didwania",
    phone: "8981268688",
    extra: "Paper printed cake toppers",
    supplies: ["toppers"],
  },
  {
    name: "Alok Lata Delivery Service",
    phone: "9804340316",
    altPhone: "9830352426",
    contact: "Jeet Basu",
    supplies: ["delivery"],
  },
  {
    name: "Gourav Verma",
    phone: "8100027901",
    address: "17, Pratap C. Ghosh Lane, Jorasanko",
    supplies: [],
  },
  {
    name: "Bio Box India",
    phone: "7003495844",
    contact: "Kaustav Dey",
    extra: "Biodegradable disposable thali, bati, glass, etc.",
    supplies: ["packaging"],
  },
  {
    name: "Bake Emporium",
    phone: "9830692927",
    contact: "Supriti Guha",
    address: "Shyambazar",
    supplies: ["packaging"],
  },
  {
    name: "Bakerry",
    phone: "9073332135",
    altPhone: "9903602490",
    address: "HI-14/1, Baguihati, Joramandir",
    supplies: ["packaging"],
  },
  {
    name: "Narayan Garai",
    phone: "8240606342",
    extra: "Multi-layer cake stand, cheap piping bags",
    supplies: ["packaging"],
  },
  {
    name: "Nextgen Traders",
    phone: "9279828695",
    address: "Baranagar, Noapara",
    extra: "Piping bags",
    supplies: ["packaging"],
  },
  {
    name: "Arunima Dutta",
    phone: "9875612067",
    address: "Naktala Udayan Sangha",
    supplies: [],
  },
  {
    name: "Yousuf Faraz",
    phone: "9883847117",
    address: "24, Pollock Street",
    extra: "Dolls",
    supplies: ["toppers"],
  },
  {
    name: "Deekshi Suresh",
    phone: "8531864268",
    extra: "Toppers 20/21, size 5\" and 6\"",
    supplies: ["toppers"],
  },
  { name: "Manisha Murali", phone: "8754509249", supplies: [] },
  {
    name: "Khan Yusuf",
    phone: "9873164710",
    extra: "Cake pencil",
    supplies: ["toppers"],
  },
  {
    name: "Jyoti Kedia",
    phone: "9811236684",
    extra: "Sprinklers and more",
    supplies: ["toppers"],
  },
  {
    name: "Juhi Shivani",
    phone: "9826784051",
    extra: "Acrylic topper ₹25 for big size",
    supplies: ["toppers"],
  },
  {
    name: "Bakery materials Supplier India",
    phone: "9887009194",
    supplies: ["dry-goods", "packaging"],
  },
];

function notesFor(row: (typeof VENDOR_SEED)[number]): string | null {
  const bits = [
    row.contact && row.contact !== row.name ? `Contact: ${row.contact}` : null,
    row.altPhone ? `Alt: ${row.altPhone}` : null,
    row.extra,
  ].filter(Boolean);
  return bits.length ? bits.join(" · ") : null;
}

/** Inserts the Excel list. Skips a row if that phone is already on a vendor. */
export async function seedVendors() {
  let created = 0;
  let skipped = 0;
  for (const row of VENDOR_SEED) {
    const phone = normalizeCustomerPhone(row.phone);
    const existing = await prisma.vendor.findFirst({
      where: { phone },
      select: { id: true },
    });
    if (existing) {
      if (row.address) {
        await prisma.vendor.updateMany({
          where: { id: existing.id, address: null },
          data: { address: row.address },
        });
      }
      skipped += 1;
      continue;
    }
    await prisma.vendor.create({
      data: {
        name: row.name,
        phone,
        supplies: row.supplies,
        address: row.address ?? null,
        notes: notesFor(row),
        accountHint: row.altPhone ? `Alt ${row.altPhone}` : null,
      },
    });
    created += 1;
  }
  logger.info(`Vendors seed: ${created} added, ${skipped} already present`);
}
