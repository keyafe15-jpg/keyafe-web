/**
 * GST state codes shared by storefront + admin.
 * Kept aligned with server/src/lib/indiaStates.ts for tax place-of-supply.
 */

export const GST_STATE_NAMES: Record<string, string> = {
  "01": "Jammu and Kashmir",
  "02": "Himachal Pradesh",
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  "10": "Bihar",
  "11": "Sikkim",
  "12": "Arunachal Pradesh",
  "13": "Nagaland",
  "14": "Manipur",
  "15": "Mizoram",
  "16": "Tripura",
  "17": "Meghalaya",
  "18": "Assam",
  "19": "West Bengal",
  "20": "Jharkhand",
  "21": "Odisha",
  "22": "Chhattisgarh",
  "23": "Madhya Pradesh",
  "24": "Gujarat",
  "25": "Daman and Diu",
  "26": "Dadra and Nagar Haveli and Daman and Diu",
  "27": "Maharashtra",
  "28": "Andhra Pradesh (Old)",
  "29": "Karnataka",
  "30": "Goa",
  "31": "Lakshadweep",
  "32": "Kerala",
  "33": "Tamil Nadu",
  "34": "Puducherry",
  "35": "Andaman and Nicobar Islands",
  "36": "Telangana",
  "37": "Andhra Pradesh",
  "38": "Ladakh",
  "97": "Other Territory",
};

export const WEST_BENGAL_CODE = "19";

/** Retired by reorganisation — still parsed, never offered as a choice. */
const LEGACY_CODES = new Set(["25", "28", "97"]);

/** Alphabetical picker list (excludes legacy codes). */
export const SELECTABLE_STATES: { code: string; name: string }[] = Object.entries(GST_STATE_NAMES)
  .filter(([code]) => !LEGACY_CODES.has(code))
  .map(([code, name]) => ({ code, name }))
  .sort((a, b) => a.name.localeCompare(b.name));

const NAME_ALIASES: Record<string, string> = {
  orissa: "21",
  pondicherry: "34",
  uttaranchal: "05",
  "nct of delhi": "07",
  "new delhi": "07",
  "national capital territory of delhi": "07",
  "dadra and nagar haveli": "26",
  "daman and diu": "26",
  "andaman and nicobar": "35",
  tamilnadu: "33",
  telengana: "36",
  chattisgarh: "22",
};

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/&/g, "and").replace(/[.]/g, "").replace(/\s+/g, " ");
}

const NAME_TO_CODE = new Map<string, string>();
for (const [code, name] of Object.entries(GST_STATE_NAMES)) {
  NAME_TO_CODE.set(normalizeName(name), code);
}
for (const [alias, code] of Object.entries(NAME_ALIASES)) {
  NAME_TO_CODE.set(normalizeName(alias), code);
}

export function stateCodeFromName(name: string | null | undefined): string | null {
  if (!name) return null;
  return NAME_TO_CODE.get(normalizeName(name)) ?? null;
}

export function stateNameFromCode(code: string | null | undefined): string | null {
  if (!code) return null;
  const padded = String(code).replace(/\D/g, "").padStart(2, "0");
  return GST_STATE_NAMES[padded] ?? null;
}
