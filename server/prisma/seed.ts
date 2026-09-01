import { PrismaClient } from "@prisma/client";
import { logger } from "../src/utils/logger.js";

const prisma = new PrismaClient();

async function seedBusinessSettings() {
  const existing = await prisma.businessSettings.findFirst();
  if (existing) {
    logger.info("BusinessSettings already exists — skipping");
    return existing;
  }

  const created = await prisma.businessSettings.create({
    data: {
      legalName: "Keyafe Foods",
      tradeName: "Keyafe",
      registeredAddress: {
        line1: "",
        line2: "",
        city: "Howrah",
        state: "West Bengal",
        stateCode: "19",
        pincode: "711202",
      },
      supportEmail: "hello@keyafe.example",
      supportPhone: "9330048665",
    },
  });
  logger.info(`Created BusinessSettings ${created.id}`);
  return created;
}

async function seedSameDayWeeklySchedule() {
  // 0 = Sunday .. 6 = Saturday — same 11:00 – 23:00 for every day.
  const days = [0, 1, 2, 3, 4, 5, 6];

  await Promise.all(
    days.map((dayOfWeek) =>
      prisma.sameDayScheduleWeekly.upsert({
        where: { dayOfWeek },
        create: {
          dayOfWeek,
          isClosed: false,
          openTime: "11:00",
          closeTime: "23:00",
        },
        // Idempotent: only fill in missing values, don't clobber admin edits.
        update: {},
      }),
    ),
  );
  logger.info("Seeded SameDayScheduleWeekly (7 rows @ 11:00–23:00)");
}

async function seedDeliveryPincodes() {
  // Launch local-delivery coverage from Belur (711202). Customer-facing fees
  // intentionally use subsidized slabs; operational rider-cost notes stay out
  // of the customer checkout flow.
  const zones = [
    {
      pincode: "711202",
      city: "Howrah",
      area: "Belur",
      district: "HOWRAH",
      deliveryFee: 49,
      minOrderAmount: 299,
      sameDayEligible: true,
      expressEligible: true,
      extraLeadHours: 0,
      notes: "dispatch pincode; 711202 includes Belur Math and Belur Bazar",
    },
    {
      pincode: "711201",
      city: "Howrah",
      area: "Bally",
      district: "HOWRAH",
      deliveryFee: 49,
      minOrderAmount: 299,
      sameDayEligible: true,
      expressEligible: true,
      extraLeadHours: 0,
      notes:
        "verify pincode before import; Bally locality may span adjoining pincodes",
    },
    {
      pincode: "711204",
      city: "Howrah",
      area: "Liluah",
      district: "HOWRAH",
      deliveryFee: 49,
      minOrderAmount: 299,
      sameDayEligible: true,
      expressEligible: true,
      extraLeadHours: 0,
      notes: "711204 includes Liluah and Shibtala Liluah postal areas",
    },
    {
      pincode: "711106",
      city: "Howrah",
      area: "Salkia",
      district: "HOWRAH",
      deliveryFee: 49,
      minOrderAmount: 349,
      sameDayEligible: true,
      expressEligible: true,
      extraLeadHours: 0,
      notes: "pincode also serves multiple nearby Howrah localities",
    },
    {
      pincode: "711101",
      city: "Howrah",
      area: "Howrah Central",
      district: "HOWRAH",
      deliveryFee: 69,
      minOrderAmount: 349,
      sameDayEligible: true,
      expressEligible: true,
      extraLeadHours: 0,
      notes: "711101 is shared by multiple central Howrah postal areas",
    },
    {
      pincode: "711102",
      city: "Howrah",
      area: "Shibpur",
      district: "HOWRAH",
      deliveryFee: 69,
      minOrderAmount: 399,
      sameDayEligible: true,
      expressEligible: true,
      extraLeadHours: 0,
      notes: "711102 includes Sibpur and Sibpur Bazar postal areas",
    },
    {
      pincode: "711104",
      city: "Howrah",
      area: "Santragachi",
      district: "HOWRAH",
      deliveryFee: 69,
      minOrderAmount: 399,
      sameDayEligible: true,
      expressEligible: true,
      extraLeadHours: 1,
      notes:
        "711104 is shared by Santragachi Ramrajatala and nearby postal areas",
    },
    {
      pincode: "711203",
      city: "Howrah",
      area: "Bhattanagar",
      district: "HOWRAH",
      deliveryFee: 49,
      minOrderAmount: 349,
      sameDayEligible: true,
      expressEligible: true,
      extraLeadHours: 0,
      notes: "near Belur-Liluah belt",
    },
    {
      pincode: "711205",
      city: "Howrah",
      area: "Bally-Jagachha",
      district: "HOWRAH",
      deliveryFee: 69,
      minOrderAmount: 349,
      sameDayEligible: true,
      expressEligible: true,
      extraLeadHours: 1,
      notes: "verify pincode before import; locality naming varies",
    },
    {
      pincode: "711206",
      city: "Howrah",
      area: "Sapuipara",
      district: "HOWRAH",
      deliveryFee: 69,
      minOrderAmount: 399,
      sameDayEligible: true,
      expressEligible: true,
      extraLeadHours: 1,
      notes: "near Bally-Jagachha belt",
    },
    {
      pincode: "711302",
      city: "Howrah",
      area: "Andul",
      district: "HOWRAH",
      deliveryFee: 99,
      minOrderAmount: 499,
      sameDayEligible: true,
      expressEligible: false,
      extraLeadHours: 2,
      notes: "pincode covers Andul and nearby localities",
    },
    {
      pincode: "711403",
      city: "Howrah",
      area: "Bankra",
      district: "HOWRAH",
      deliveryFee: 99,
      minOrderAmount: 499,
      sameDayEligible: true,
      expressEligible: false,
      extraLeadHours: 2,
      notes: "western Howrah; rider availability may vary",
    },
    {
      pincode: "711409",
      city: "Howrah",
      area: "Salap",
      district: "HOWRAH",
      deliveryFee: 99,
      minOrderAmount: 499,
      sameDayEligible: true,
      expressEligible: false,
      extraLeadHours: 2,
      notes: "pincode also associated with nearby Makardaha-side localities",
    },
    {
      pincode: "700001",
      city: "Kolkata",
      area: "BBD Bagh",
      district: "KOLKATA",
      deliveryFee: 99,
      minOrderAmount: 499,
      sameDayEligible: true,
      expressEligible: true,
      extraLeadHours: 1,
      notes: "central Kolkata; traffic-sensitive",
    },
    {
      pincode: "700016",
      city: "Kolkata",
      area: "Park Street",
      district: "KOLKATA",
      deliveryFee: 99,
      minOrderAmount: 499,
      sameDayEligible: true,
      expressEligible: true,
      extraLeadHours: 1,
      notes: "central Kolkata; peak-hour rider cost may increase",
    },
    {
      pincode: "700020",
      city: "Kolkata",
      area: "Bhowanipore",
      district: "KOLKATA",
      deliveryFee: 99,
      minOrderAmount: 549,
      sameDayEligible: true,
      expressEligible: true,
      extraLeadHours: 2,
      notes:
        "verify exact delivery address because nearby localities use multiple pincodes",
    },
    {
      pincode: "700019",
      city: "Kolkata",
      area: "Ballygunge",
      district: "KOLKATA",
      deliveryFee: 129,
      minOrderAmount: 599,
      sameDayEligible: true,
      expressEligible: false,
      extraLeadHours: 2,
      notes: "pincode shared across parts of Ballygunge",
    },
    {
      pincode: "700029",
      city: "Kolkata",
      area: "Gariahat",
      district: "KOLKATA",
      deliveryFee: 129,
      minOrderAmount: 599,
      sameDayEligible: true,
      expressEligible: false,
      extraLeadHours: 2,
      notes:
        "verify exact delivery address; Gariahat catchment spans nearby pincodes",
    },
    {
      pincode: "700032",
      city: "Kolkata",
      area: "Jadavpur",
      district: "KOLKATA",
      deliveryFee: 129,
      minOrderAmount: 649,
      sameDayEligible: true,
      expressEligible: false,
      extraLeadHours: 2,
      notes: "Jadavpur postal area",
    },
    {
      pincode: "700064",
      city: "Kolkata",
      area: "Salt Lake",
      district: "KOLKATA",
      deliveryFee: 129,
      minOrderAmount: 599,
      sameDayEligible: true,
      expressEligible: true,
      extraLeadHours: 2,
      notes: "verify sector before import; Salt Lake uses multiple pincodes",
    },
    {
      pincode: "700091",
      city: "Kolkata",
      area: "Salt Lake Sector V",
      district: "KOLKATA",
      deliveryFee: 129,
      minOrderAmount: 599,
      sameDayEligible: true,
      expressEligible: true,
      extraLeadHours: 2,
      notes: "primarily Sector V and adjoining office district",
    },
    {
      pincode: "700028",
      city: "Kolkata",
      area: "Dum Dum",
      district: "KOLKATA",
      deliveryFee: 129,
      minOrderAmount: 599,
      sameDayEligible: true,
      expressEligible: false,
      extraLeadHours: 2,
      notes: "verify exact address; greater Dum Dum spans multiple pincodes",
    },
    {
      pincode: "700048",
      city: "Kolkata",
      area: "Lake Town-Sreebhumi",
      district: "KOLKATA",
      deliveryFee: 129,
      minOrderAmount: 599,
      sameDayEligible: true,
      expressEligible: false,
      extraLeadHours: 2,
      notes: "pincode covers Sreebhumi and adjoining localities",
    },
    {
      pincode: "700156",
      city: "Kolkata",
      area: "New Town",
      district: "KOLKATA",
      deliveryFee: 149,
      minOrderAmount: 699,
      sameDayEligible: true,
      expressEligible: false,
      extraLeadHours: 3,
      notes:
        "New Town postal area; farther action areas may need additional lead time",
    },
    {
      pincode: "700099",
      city: "Kolkata",
      area: "Mukundapur",
      district: "KOLKATA",
      deliveryFee: 149,
      minOrderAmount: 699,
      sameDayEligible: true,
      expressEligible: false,
      extraLeadHours: 3,
      notes:
        "verify exact delivery address; EM Bypass-side locality boundaries vary",
    },
    {
      pincode: "700084",
      city: "Kolkata",
      area: "Garia",
      district: "KOLKATA",
      deliveryFee: 149,
      minOrderAmount: 749,
      sameDayEligible: true,
      expressEligible: false,
      extraLeadHours: 3,
      notes: "verify pincode before import; Garia spans several postal codes",
    },
    {
      pincode: "700034",
      city: "Kolkata",
      area: "Behala",
      district: "KOLKATA",
      deliveryFee: 149,
      minOrderAmount: 749,
      sameDayEligible: true,
      expressEligible: false,
      extraLeadHours: 3,
      notes: "Behala area; exact locality may use adjoining pincodes",
    },
    {
      pincode: "700063",
      city: "Kolkata",
      area: "Thakurpukur",
      district: "KOLKATA",
      deliveryFee: 179,
      minOrderAmount: 799,
      sameDayEligible: true,
      expressEligible: false,
      extraLeadHours: 4,
      notes:
        "southwestern Kolkata; traffic and rider availability can increase cost",
    },
    {
      pincode: "712258",
      city: "Hooghly",
      area: "Uttarpara",
      district: "HOOGHLY",
      deliveryFee: 99,
      minOrderAmount: 499,
      sameDayEligible: true,
      expressEligible: true,
      extraLeadHours: 1,
      notes: "Uttarpara Kotrung municipal area",
    },
    {
      pincode: "712235",
      city: "Hooghly",
      area: "Konnagar",
      district: "HOOGHLY",
      deliveryFee: 99,
      minOrderAmount: 499,
      sameDayEligible: true,
      expressEligible: true,
      extraLeadHours: 1,
      notes: "Konnagar municipal area",
    },
    {
      pincode: "712248",
      city: "Hooghly",
      area: "Rishra",
      district: "HOOGHLY",
      deliveryFee: 99,
      minOrderAmount: 549,
      sameDayEligible: true,
      expressEligible: false,
      extraLeadHours: 2,
      notes: "Rishra municipal area",
    },
    {
      pincode: "712201",
      city: "Hooghly",
      area: "Serampore",
      district: "HOOGHLY",
      deliveryFee: 129,
      minOrderAmount: 599,
      sameDayEligible: true,
      expressEligible: false,
      extraLeadHours: 2,
      notes:
        "pincode serves Serampore; some nearby Mahesh addresses use 712202",
    },
    {
      pincode: "712202",
      city: "Hooghly",
      area: "Mahesh-Serampore",
      district: "HOOGHLY",
      deliveryFee: 129,
      minOrderAmount: 599,
      sameDayEligible: true,
      expressEligible: false,
      extraLeadHours: 2,
      notes: "adjacent Serampore-Mahesh delivery area",
    },
    {
      pincode: "712223",
      city: "Hooghly",
      area: "Sheoraphuli",
      district: "HOOGHLY",
      deliveryFee: 129,
      minOrderAmount: 649,
      sameDayEligible: true,
      expressEligible: false,
      extraLeadHours: 2,
      notes:
        "verify exact delivery address; pincode may cover multiple nearby postal areas",
    },
    {
      pincode: "712124",
      city: "Hooghly",
      area: "Bhadreswar",
      district: "HOOGHLY",
      deliveryFee: 149,
      minOrderAmount: 699,
      sameDayEligible: true,
      expressEligible: false,
      extraLeadHours: 3,
      notes: "Bhadreswar postal area; rider availability can vary",
    },
    {
      pincode: "712136",
      city: "Hooghly",
      area: "Chandannagar",
      district: "HOOGHLY",
      deliveryFee: 149,
      minOrderAmount: 749,
      sameDayEligible: true,
      expressEligible: false,
      extraLeadHours: 3,
      notes: "Chandannagar and Chandannagar RS commonly use this pincode",
    },
    {
      pincode: "712101",
      city: "Hooghly",
      area: "Chinsurah",
      district: "HOOGHLY",
      deliveryFee: 179,
      minOrderAmount: 899,
      sameDayEligible: true,
      expressEligible: false,
      extraLeadHours: 4,
      notes: "central Chinsurah; municipality also contains adjoining pincodes",
    },
    {
      pincode: "712123",
      city: "Hooghly",
      area: "Bandel",
      district: "HOOGHLY",
      deliveryFee: 179,
      minOrderAmount: 999,
      sameDayEligible: true,
      expressEligible: false,
      extraLeadHours: 4,
      notes: "Bandel postal area; longer bike run from Belur",
    },
    {
      pincode: "712103",
      city: "Hooghly",
      area: "Chinsurah-West",
      district: "HOOGHLY",
      deliveryFee: 179,
      minOrderAmount: 999,
      sameDayEligible: true,
      expressEligible: false,
      extraLeadHours: 4,
      notes:
        "verify pincode before import; use only after matching customer locality",
    },
    {
      pincode: "712105",
      city: "Hooghly",
      area: "Buroshibtala-Chinsurah",
      district: "HOOGHLY",
      deliveryFee: 179,
      minOrderAmount: 999,
      sameDayEligible: true,
      expressEligible: false,
      extraLeadHours: 4,
      notes: "verify exact address before import",
    },
    {
      pincode: "712311",
      city: "Hooghly",
      area: "Dankuni",
      district: "HOOGHLY",
      deliveryFee: 99,
      minOrderAmount: 549,
      sameDayEligible: true,
      expressEligible: false,
      extraLeadHours: 2,
      notes:
        "Dankuni municipal area; practical via road but rider pricing can fluctuate",
    },
    {
      pincode: "712232",
      city: "Hooghly",
      area: "Bhadrakali",
      district: "HOOGHLY",
      deliveryFee: 99,
      minOrderAmount: 499,
      sameDayEligible: true,
      expressEligible: true,
      extraLeadHours: 1,
      notes: "near Uttarpara; pincode serves Bhadrakali postal area",
    },
    {
      pincode: "712250",
      city: "Hooghly",
      area: "Morepukur-Rishra",
      district: "HOOGHLY",
      deliveryFee: 99,
      minOrderAmount: 549,
      sameDayEligible: true,
      expressEligible: false,
      extraLeadHours: 2,
      notes: "verify exact delivery address before import",
    },
    {
      pincode: "712137",
      city: "Hooghly",
      area: "Gondalpara-Chandannagar",
      district: "HOOGHLY",
      deliveryFee: 149,
      minOrderAmount: 749,
      sameDayEligible: true,
      expressEligible: false,
      extraLeadHours: 3,
      notes: "Chandannagar locality; separate from main 712136 postal area",
    },
    {
      pincode: "712502",
      city: "Hooghly",
      area: "Bansberia",
      district: "HOOGHLY",
      deliveryFee: 179,
      minOrderAmount: 1199,
      sameDayEligible: false,
      expressEligible: false,
      extraLeadHours: 6,
      notes:
        "long-distance delivery; schedule in advance and confirm rider availability",
    },
    {
      pincode: "712503",
      city: "Hooghly",
      area: "Tribeni",
      district: "HOOGHLY",
      deliveryFee: 179,
      minOrderAmount: 1299,
      sameDayEligible: false,
      expressEligible: false,
      extraLeadHours: 6,
      notes:
        "operationally difficult for fresh bakery items; advance-order delivery recommended",
    },
  ] as const;

  for (const z of zones) {
    const data = {
      city: z.city,
      area: z.area ?? null,
      district: z.district,
      deliveryFee: z.deliveryFee,
      minOrderAmount: z.minOrderAmount,
      extraLeadHours: z.extraLeadHours,
      sameDayEligible: z.sameDayEligible,
      expressEligible: z.expressEligible,
      notes: z.notes,
      isActive: true,
    };

    await prisma.deliveryPincode.upsert({
      where: { pincode: z.pincode },
      create: {
        pincode: z.pincode,
        ...data,
      },
      update: data,
    });
  }
  logger.info(`Seeded ${zones.length} delivery pincodes`);
}

async function seedFlavors() {
  // Full launch catalogue. Order preserved via `sortOrder` (step of 10 for easy re-insertion).
  const flavors: {
    slug: string;
    name: string;
    isSugarFree?: boolean;
    isHealthy?: boolean;
    description?: string;
  }[] = [
    // Classic & fruit
    { slug: "vanilla", name: "Vanilla" },
    { slug: "vanilla-custard", name: "Vanilla Custard" },
    { slug: "strawberry", name: "Strawberry" },
    { slug: "blueberry", name: "Blueberry" },
    { slug: "lemon-curd-blueberry", name: "Lemon Curd & Blueberry" },
    { slug: "butterscotch", name: "Butterscotch" },
    { slug: "pineapple", name: "Pineapple" },
    { slug: "rasmalai", name: "Rasmalai" },

    // Red velvet variants
    {
      slug: "red-velvet-cream-cheese",
      name: "Red Velvet with Cream Cheese Frosting",
    },
    {
      slug: "red-velvet-white-chocolate-mousse",
      name: "Red Velvet with White Chocolate Mousse",
    },

    // Biscoff family
    { slug: "lotus-biscoff", name: "Lotus Biscoff" },
    { slug: "lotus-biscoff-cheesecake", name: "Lotus Biscoff Cheesecake" },

    // Forest
    { slug: "black-forest", name: "Black Forest" },
    { slug: "white-forest", name: "White Forest" },

    // Tropical & floral
    {
      slug: "mango-cream-cheese-coconut",
      name: "Mango Cream Cheese Mousse with Coconut",
    },
    { slug: "litchi", name: "Litchi" },
    { slug: "mango-litchi", name: "Mango Litchi" },
    { slug: "rose-litchi", name: "Rose Litchi" },
    { slug: "rose-pistachio", name: "Rose Pistachio" },

    // Chocolate family
    { slug: "chocolate-custard", name: "Chocolate Custard" },
    { slug: "chocolate-truffle", name: "Chocolate Truffle" },
    { slug: "excess-chocolate", name: "Excess Chocolate" },
    { slug: "chocolate-cheesecake", name: "Chocolate Cheesecake" },
    { slug: "chocolate-oreo", name: "Chocolate Oreo" },
    { slug: "cookies-and-cream", name: "Cookies and Cream" },
    { slug: "chocolate-praline", name: "Chocolate Praline" },
    { slug: "chocolate-crunchy-granola", name: "Chocolate Crunchy Granola" },
    { slug: "nutella-ferrero-rocher", name: "Nutella Ferrero Rocher" },

    // Signature
    { slug: "thandai", name: "Thandai" },
    { slug: "coffee-caramel", name: "Coffee Caramel" },

    // Healthy — natural sweeteners, whole grains
    {
      slug: "atta-jaggery-chocolate",
      name: "Atta Jaggery Chocolate",
      description: "Whole wheat with jaggery — no refined sugar.",
      isHealthy: true,
    },

    // Sugar-free variants (also count as healthy)
    {
      slug: "vanilla-sugar-free",
      name: "Vanilla (Sugar-Free)",
      isSugarFree: true,
      isHealthy: true,
    },
    {
      slug: "strawberry-sugar-free",
      name: "Strawberry (Sugar-Free)",
      isSugarFree: true,
      isHealthy: true,
    },
    {
      slug: "chocolate-sugar-free",
      name: "Chocolate (Sugar-Free)",
      isSugarFree: true,
      isHealthy: true,
    },
    {
      slug: "butterscotch-sugar-free",
      name: "Butterscotch (Sugar-Free)",
      isSugarFree: true,
      isHealthy: true,
    },
    {
      slug: "blueberry-sugar-free",
      name: "Blueberry (Sugar-Free)",
      isSugarFree: true,
      isHealthy: true,
    },
  ];

  for (const [idx, f] of flavors.entries()) {
    await prisma.flavor.upsert({
      where: { slug: f.slug },
      create: {
        slug: f.slug,
        name: f.name,
        description: f.description ?? null,
        isSugarFree: f.isSugarFree ?? false,
        isHealthy: f.isHealthy ?? false,
        sortOrder: (idx + 1) * 10,
      },
      // Sync classification flags + sort on re-run. Description + isEggless + isActive
      // stay admin-owned once set.
      update: {
        name: f.name,
        isSugarFree: f.isSugarFree ?? false,
        isHealthy: f.isHealthy ?? false,
        sortOrder: (idx + 1) * 10,
      },
    });
  }
  logger.info(`Seeded ${flavors.length} flavours`);
}

async function seedCakeSizes() {
  const sizes: {
    grams: number;
    label: string;
    servesText: string;
    sortOrder: number;
  }[] = [
    { grams: 150, label: "Bento", servesText: "Serves 1", sortOrder: 5 },
    { grams: 200, label: "Mini", servesText: "Serves 1–2", sortOrder: 8 },
    { grams: 250, label: "½ pound", servesText: "Serves 2–4", sortOrder: 10 },
    { grams: 500, label: "1 pound", servesText: "Serves 4–6", sortOrder: 20 },
    { grams: 750, label: "1½ pound", servesText: "Serves 6–8", sortOrder: 30 },
    { grams: 1000, label: "2 pound", servesText: "Serves 8–12", sortOrder: 40 },
    {
      grams: 1500,
      label: "3 pound",
      servesText: "Serves 14–18",
      sortOrder: 50,
    },
    {
      grams: 2500,
      label: "5 pound",
      servesText: "Serves 22–28",
      sortOrder: 60,
    },
  ];

  for (const s of sizes) {
    await prisma.cakeSize.upsert({
      where: { grams: s.grams },
      create: {
        grams: s.grams,
        label: s.label,
        servesText: s.servesText,
        sortOrder: s.sortOrder,
      },
      // Preserve admin edits to label / servesText; only refresh sort.
      update: { sortOrder: s.sortOrder },
    });
  }
  logger.info(`Seeded ${sizes.length} cake sizes`);
}

async function seedCategories() {
  // Two-level hierarchy. Parents first, then children reference by slug lookup.
  const tree: {
    slug: string;
    name: string;
    description?: string;
    sortOrder: number;
    children?: { slug: string; name: string; sortOrder: number }[];
  }[] = [
    {
      slug: "celebration-cakes",
      name: "Celebration Cakes",
      description: "Custom flavours, tiers & fondant art for every occasion.",
      sortOrder: 10,
      children: [
        { slug: "birthday-cakes", name: "Birthday", sortOrder: 10 },
        { slug: "anniversary-cakes", name: "Anniversary", sortOrder: 20 },
        { slug: "baby-shower-cakes", name: "Baby Shower", sortOrder: 30 },
        { slug: "wedding-cakes", name: "Wedding", sortOrder: 40 },
        { slug: "kids-cakes", name: "Kids Special", sortOrder: 50 },
        { slug: "custom-cakes", name: "Custom Design", sortOrder: 60 },
      ],
    },
    {
      slug: "dry-cakes",
      name: "Dry Cakes",
      description: "Loaves & tea cakes for every day.",
      sortOrder: 20,
    },
    {
      slug: "tubs",
      name: "Cake & Cookie Tubs",
      description: "Bite-sized joy in a jar.",
      sortOrder: 30,
    },
    {
      slug: "pizzas",
      name: "Pizzas",
      description: "Hand-tossed, wood-fired.",
      sortOrder: 40,
    },
    {
      slug: "panuozzo",
      name: "Panuozzo",
      description: "Italian sandwiches on baked pizza dough.",
      sortOrder: 50,
    },
    {
      slug: "focaccia-sandwich",
      name: "Focaccia Sandwich",
      description: "Herbed focaccia with hearty fillings.",
      sortOrder: 60,
    },
    {
      slug: "house-special-snacks",
      name: "Other House Special Snacks",
      description: "Savoury specials from our kitchen.",
      sortOrder: 70,
    },
  ];

  // Upsert parents first so children can reference their id.
  for (const parent of tree) {
    const parentRow = await prisma.category.upsert({
      where: { slug: parent.slug },
      create: {
        slug: parent.slug,
        name: parent.name,
        description: parent.description ?? null,
        sortOrder: parent.sortOrder,
      },
      update: {
        name: parent.name,
        description: parent.description ?? null,
        sortOrder: parent.sortOrder,
      },
    });

    for (const child of parent.children ?? []) {
      await prisma.category.upsert({
        where: { slug: child.slug },
        create: {
          slug: child.slug,
          name: child.name,
          sortOrder: child.sortOrder,
          parentId: parentRow.id,
        },
        update: {
          name: child.name,
          sortOrder: child.sortOrder,
          parentId: parentRow.id,
        },
      });
    }
  }

  const total = tree.reduce((n, p) => n + 1 + (p.children?.length ?? 0), 0);
  logger.info(`Seeded ${total} categories (${tree.length} top-level)`);
}

async function seedProducts() {
  const productRows = [
    {
      slug: "classic-vanilla-birthday-cake",
      name: "Classic Vanilla Birthday Cake",
      categorySlug: "birthday-cakes",
      shortDescription: "Soft vanilla sponge with a buttery cream finish.",
      basePrice: 1099,
      template: "CAKE",
      productType: "CONFIGURABLE",
      images: [
        "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=900&q=80",
      ],
      isFeatured: true,
      supportsSameDayDelivery: true,
      isHealthyTreat: false,
      sortOrder: 10,
    },
    {
      slug: "dark-chocolate-truffle-birthday-cake",
      name: "Dark Chocolate Truffle Birthday Cake",
      categorySlug: "birthday-cakes",
      shortDescription: "Rich chocolate sponge with silky truffle ganache.",
      basePrice: 1299,
      template: "CAKE",
      productType: "CONFIGURABLE",
      images: [
        "https://images.unsplash.com/photo-1559628235-42d5a3b1b4a2?auto=format&fit=crop&w=900&q=80",
      ],
      isFeatured: true,
      supportsSameDayDelivery: true,
      sortOrder: 20,
    },
    {
      slug: "strawberry-cream-birthday-cake",
      name: "Strawberry Cream Birthday Cake",
      categorySlug: "birthday-cakes",
      shortDescription: "Fresh strawberry notes with fluffy cream layers.",
      basePrice: 1199,
      template: "CAKE",
      productType: "CONFIGURABLE",
      images: [
        "https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?auto=format&fit=crop&w=900&q=80",
      ],
      sortOrder: 30,
    },
    {
      slug: "butterscotch-burst-birthday-cake",
      name: "Butterscotch Burst Birthday Cake",
      categorySlug: "birthday-cakes",
      shortDescription: "Caramelised butterscotch on a light sponge base.",
      basePrice: 1349,
      template: "CAKE",
      productType: "CONFIGURABLE",
      images: [
        "https://images.unsplash.com/photo-1486427944299-d1955d23e34d?auto=format&fit=crop&w=900&q=80",
      ],
      sortOrder: 40,
    },
    {
      slug: "red-velvet-delight-birthday-cake",
      name: "Red Velvet Delight Birthday Cake",
      categorySlug: "birthday-cakes",
      shortDescription: "Classic red velvet with cream cheese frosting.",
      basePrice: 1499,
      template: "CAKE",
      productType: "CONFIGURABLE",
      images: [
        "https://images.unsplash.com/photo-1533134242443-d6bbb7d6d0c9?auto=format&fit=crop&w=900&q=80",
      ],
      isFeatured: true,
      sortOrder: 50,
    },
    {
      slug: "rasmalai-birthday-cake",
      name: "Rasmalai Birthday Cake",
      categorySlug: "birthday-cakes",
      shortDescription: "A fragrant rasmalai-inspired cream cake.",
      basePrice: 1549,
      template: "CAKE",
      productType: "CONFIGURABLE",
      images: [
        "https://images.unsplash.com/photo-1563729784474-d77dbb933a9e?auto=format&fit=crop&w=900&q=80",
      ],
      sortOrder: 60,
    },
    {
      slug: "blueberry-bliss-birthday-cake",
      name: "Blueberry Bliss Birthday Cake",
      categorySlug: "birthday-cakes",
      shortDescription: "Juicy blueberry layers with soft vanilla cream.",
      basePrice: 1399,
      template: "CAKE",
      productType: "CONFIGURABLE",
      images: [
        "https://images.unsplash.com/photo-1558301211-0d8c8ddee6ec?auto=format&fit=crop&w=900&q=80",
      ],
      sortOrder: 70,
    },
    {
      slug: "peach-rose-birthday-cake",
      name: "Peach Rose Birthday Cake",
      categorySlug: "birthday-cakes",
      shortDescription: "Delicate peach flavour with a floral cream finish.",
      basePrice: 1419,
      template: "CAKE",
      productType: "CONFIGURABLE",
      images: [
        "https://images.unsplash.com/photo-1521305916504-4a1121188589?auto=format&fit=crop&w=900&q=80",
      ],
      sortOrder: 80,
    },
    {
      slug: "choco-fudge-birthday-cake",
      name: "Choco Fudge Birthday Cake",
      categorySlug: "birthday-cakes",
      shortDescription: "Mud-smooth chocolate layers with fudge icing.",
      basePrice: 1599,
      template: "CAKE",
      productType: "CONFIGURABLE",
      images: [
        "https://images.unsplash.com/photo-1486427944299-d1955d23e34d?auto=format&fit=crop&w=900&q=80",
      ],
      isFeatured: true,
      sortOrder: 90,
    },
    {
      slug: "cookie-monster-birthday-cake",
      name: "Cookie Monster Birthday Cake",
      categorySlug: "birthday-cakes",
      shortDescription: "Chocolate sponge with cookie crumble and cream.",
      basePrice: 1475,
      template: "CAKE",
      productType: "CONFIGURABLE",
      images: [
        "https://images.unsplash.com/photo-1551024601-bec78aea704b?auto=format&fit=crop&w=900&q=80",
      ],
      sortOrder: 100,
    },
    {
      slug: "mint-choco-birthday-cake",
      name: "Mint Choco Birthday Cake",
      categorySlug: "birthday-cakes",
      shortDescription: "Cool mint notes with rich chocolate frosting.",
      basePrice: 1369,
      template: "CAKE",
      productType: "CONFIGURABLE",
      images: [
        "https://images.unsplash.com/photo-1517433670267-08bbd4be890f?auto=format&fit=crop&w=900&q=80",
      ],
      sortOrder: 110,
    },
    {
      slug: "vanilla-berry-birthday-cake",
      name: "Vanilla Berry Birthday Cake",
      categorySlug: "birthday-cakes",
      shortDescription: "Vanilla sponge layered with berry compote and cream.",
      basePrice: 1450,
      template: "CAKE",
      productType: "CONFIGURABLE",
      images: [
        "https://images.unsplash.com/photo-1558301211-0d8c8ddee6ec?auto=format&fit=crop&w=900&q=80",
      ],
      sortOrder: 120,
    },
    {
      slug: "mango-celebration-cake",
      name: "Mango Celebration Cake",
      categorySlug: "birthday-cakes",
      shortDescription: "Mango cream layers with a light tropical finish.",
      basePrice: 1525,
      template: "CAKE",
      productType: "CONFIGURABLE",
      images: [
        "https://images.unsplash.com/photo-1563729784474-d77dbb933a9e?auto=format&fit=crop&w=900&q=80",
      ],
      sortOrder: 130,
    },
    {
      slug: "butterscotch-swirl-birthday-cake",
      name: "Butterscotch Swirl Birthday Cake",
      categorySlug: "birthday-cakes",
      shortDescription: "A buttery caramel swirled delight in every bite.",
      basePrice: 1499,
      template: "CAKE",
      productType: "CONFIGURABLE",
      images: [
        "https://images.unsplash.com/photo-1486427944299-d1955d23e34d?auto=format&fit=crop&w=900&q=80",
      ],
      sortOrder: 140,
    },
    {
      slug: "lemon-zest-birthday-cake",
      name: "Lemon Zest Birthday Cake",
      categorySlug: "birthday-cakes",
      shortDescription:
        "Bright citrus layers with soft buttercream and a silky finish.",
      basePrice: 1269,
      template: "CAKE",
      productType: "CONFIGURABLE",
      images: [
        "https://images.unsplash.com/photo-1521305916504-4a1121188589?auto=format&fit=crop&w=900&q=80",
      ],
      isFeatured: false,
      supportsSameDayDelivery: true,
      sortOrder: 150,
    },
  ];

  for (const product of productRows) {
    const category = await prisma.category.findUnique({
      where: { slug: product.categorySlug },
    });
    if (!category) continue;

    await prisma.product.upsert({
      where: { slug: product.slug },
      create: {
        slug: product.slug,
        name: product.name,
        shortDescription: product.shortDescription,
        categoryId: category.id,
        template: product.template,
        productType: product.productType,
        images: product.images,
        basePrice: product.basePrice,
        isFeatured: product.isFeatured ?? false,
        supportsSameDayDelivery: product.supportsSameDayDelivery ?? false,
        isHealthyTreat: product.isHealthyTreat ?? false,
        isActive: true,
        isAvailable: true,
        sortOrder: product.sortOrder,
      },
      update: {
        name: product.name,
        shortDescription: product.shortDescription,
        categoryId: category.id,
        template: product.template,
        productType: product.productType,
        images: product.images,
        basePrice: product.basePrice,
        isFeatured: product.isFeatured ?? false,
        supportsSameDayDelivery: product.supportsSameDayDelivery ?? false,
        isHealthyTreat: product.isHealthyTreat ?? false,
        isActive: true,
        isAvailable: true,
        sortOrder: product.sortOrder,
      },
    });
  }

  logger.info(`Seeded ${productRows.length} products for pagination testing`);
}

async function seedSameDayCategories() {
  const categories = [
    {
      slug: "custom-celebration-cakes",
      name: "Custom Celebration Cakes",
      description: "Occasion cakes made to order, from the same-day counter.",
      sortOrder: 10,
    },
    {
      slug: "signature-cakes",
      name: "Signature Cakes",
      description:
        "Single-flavour classics — chocolate truffle, Nutella, and more.",
      sortOrder: 20,
    },
    {
      slug: "cheesecakes",
      name: "Cheesecakes",
      description: "Baked & no-bake cheesecakes, whole or by the slice.",
      sortOrder: 30,
    },
    {
      slug: "no-cream-cakes",
      name: "No-Cream Cakes",
      description: "Loaves, sponges and ganache-only bakes without frosting.",
      sortOrder: 40,
    },
    {
      slug: "mudpies",
      name: "Mudpies",
      description: "Rich, dense chocolate mudpies.",
      sortOrder: 50,
    },
    {
      slug: "cake-tubs",
      name: "Cake Tubs",
      description: "Layered cake in a jar — spoon-ready.",
      sortOrder: 60,
    },
    {
      slug: "cookie-tubs",
      name: "Cookie Tubs",
      description: "Assorted cookie jars.",
      sortOrder: 70,
    },
    {
      slug: "cookies",
      name: "Cookies",
      description: "Freshly baked cookies by weight.",
      sortOrder: 80,
    },
    {
      slug: "muffins",
      name: "Muffins",
      description: "Everyday muffins.",
      sortOrder: 90,
    },
    {
      slug: "quick-dessert-bites",
      name: "Quick Dessert Bites",
      description: "Brownies, blondies, small sweet bites.",
      sortOrder: 100,
    },
    {
      slug: "healthy-bakes",
      name: "Healthy Bakes",
      description: "Sugar-free and jaggery-based bakes.",
      sortOrder: 110,
    },
    {
      slug: "pizzas",
      name: "Pizzas",
      description: "Hand-tossed, wood-fired.",
      sortOrder: 120,
    },
    {
      slug: "panuozzo",
      name: "Panuozzo",
      description: "Italian sandwich on baked pizza dough.",
      sortOrder: 130,
    },
    {
      slug: "focaccia-sandwich",
      name: "Focaccia Sandwich",
      description: "Herbed focaccia with hearty fillings.",
      sortOrder: 140,
    },
    {
      slug: "other-house-special-savoury",
      name: "Other House Special Savoury",
      description: "Chef's savoury specials of the day.",
      sortOrder: 150,
    },
  ];

  for (const c of categories) {
    await prisma.sameDayCategory.upsert({
      where: { slug: c.slug },
      create: { ...c, isActive: true },
      update: {
        name: c.name,
        description: c.description,
        sortOrder: c.sortOrder,
        isActive: true,
      },
    });
  }

  // Deactivate any same-day category not in the current seed list — keeps
  // the storefront in sync when we drop or rename categories.
  const activeSlugs = categories.map((c) => c.slug);
  const deactivated = await prisma.sameDayCategory.updateMany({
    where: { slug: { notIn: activeSlugs }, isActive: true },
    data: { isActive: false },
  });

  logger.info(
    `Seeded ${categories.length} same-day categories (${deactivated.count} deactivated)`,
  );
}

async function seedSampleOrders() {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    select: { id: true, name: true, basePrice: true },
    take: 12,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });

  if (products.length === 0) {
    logger.info("No products available for sample order seed");
    return;
  }

  const customerNames = [
    "Aisha Sen",
    "Rohit Nandi",
    "Tanisha Roy",
    "Manav Basu",
    "Debjani Ghosh",
    "Sayan Pal",
    "Priya Mukherjee",
    "Arjun Saha",
    "Nandini Dutta",
    "Aniket Roy",
  ];

  const today = new Date();
  const sampleDays = [1, 2, 4, 6, 8, 10, 13, 16, 20, 24];

  for (const [index, day] of sampleDays.entries()) {
    const createdAt = new Date(
      today.getFullYear(),
      today.getMonth(),
      day,
      12 + (index % 3),
      15 + index * 7,
    );
    const itemCount = index % 3 === 0 ? 2 : 1;
    const selectedProducts = products.slice(
      index % products.length,
      (index % products.length) + itemCount,
    );
    const items = selectedProducts.map((product, itemIndex) => {
      const unitPrice = Number(product.basePrice || 799);
      const qty = itemIndex === 0 ? 1 : 2;
      const lineTotal = unitPrice * qty;
      return {
        productId: product.id,
        productName: product.name,
        productSlug: product.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, ""),
        productImage: null,
        sizeLabel: itemIndex === 0 ? "1 pound" : "2 pound",
        flavourName: itemIndex === 0 ? "Vanilla" : "Chocolate",
        messageOnCake: itemIndex === 0 ? "Happy Birthday!" : null,
        instructions: null,
        deliveryDate: new Date(
          today.getFullYear(),
          today.getMonth(),
          day + 1,
          18,
          0,
        ),
        deliverySlotKey: "slot-1",
        deliverySlotLabel: "Evening Slot",
        unitPrice,
        qty,
        lineTotal,
      };
    });

    const subtotal = items.reduce(
      (sum, item) => sum + Number(item.lineTotal),
      0,
    );
    const deliveryFee = index % 2 === 0 ? 40 : 60;
    const total = subtotal + deliveryFee;

    await prisma.order.create({
      data: {
        orderNumber: `KEY-${String(today.getMonth() + 1).padStart(2, "0")}${String(day).padStart(2, "0")}${String(index + 1).padStart(4, "0")}`,
        customerName: customerNames[index % customerNames.length],
        customerPhone: `+91${9000000000 + index * 17}`,
        customerEmail: `${customerNames[index % customerNames.length].toLowerCase().replace(/\s+/g, ".")}@example.com`,
        fulfillment: "DELIVERY",
        deliveryAddress: {
          line1: `${index + 1} Example Lane`,
          line2: "Near Market Road",
          landmark: "Main Square",
          city: "Howrah",
          area: "Central",
          state: "West Bengal",
          stateCode: "19",
          pincode: "711202",
          mapSearchQuery: "Howrah Central, West Bengal",
        },
        subtotal,
        deliveryFee,
        discount: 0,
        total,
        taxableAmount: subtotal,
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: 0,
        paymentMethod: "cod",
        paymentStatus: "PAID",
        status: index % 4 === 0 ? "DELIVERED" : "CONFIRMED",
        source: "STOREFRONT",
        customerNotes: null,
        adminNotes: null,
        createdAt,
        updatedAt: createdAt,
        items: {
          create: items,
        },
      },
    });
  }

  logger.info(
    `Seeded ${sampleDays.length} sample orders for dashboard analytics`,
  );
}

async function main() {
  await seedBusinessSettings();
  await seedSameDayWeeklySchedule();
  await seedDeliveryPincodes();
  await seedFlavors();
  await seedCakeSizes();
  await seedCategories();
  await seedProducts();
  await seedSameDayCategories();
  await seedSampleOrders();
}

main()
  .catch((err) => {
    logger.error({ err }, "Seed failed");
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
