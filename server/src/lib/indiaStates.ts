// GST state codes (the first two digits of every GSTIN). These decide whether a
// supply is intra-state (CGST + SGST) or inter-state (IGST), so the mapping has
// to be exact — a wrong code means a wrongly taxed invoice.

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

// Codes retired by reorganisation. Still parsed so historic addresses resolve,
// but never offered as a choice.
const LEGACY_CODES = new Set(["25", "28", "97"]);

/** Codes offered in pickers, in the order they should be displayed. */
export const SELECTABLE_STATES: { code: string; name: string }[] =
  Object.entries(GST_STATE_NAMES)
    .filter(([code]) => !LEGACY_CODES.has(code))
    .map(([code, name]) => ({ code, name }))
    .sort((a, b) => a.name.localeCompare(b.name));

// Spellings and abbreviations that show up in Google Places results, saved
// addresses and hand-typed admin input.
const NAME_ALIASES: Record<string, string> = {
  orissa: "21",
  pondicherry: "34",
  puducherry: "34",
  uttaranchal: "05",
  uttarakhand: "05",
  "nct of delhi": "07",
  "new delhi": "07",
  delhi: "07",
  "national capital territory of delhi": "07",
  "jammu & kashmir": "01",
  "dadra and nagar haveli": "26",
  "daman and diu": "26",
  "andaman & nicobar islands": "35",
  "andaman and nicobar": "35",
  "tamilnadu": "33",
  "telengana": "36",
  "chattisgarh": "22",
  "chhatisgarh": "22",
  "ap": "37",
  "wb": "19",
  "west bengal": "19",
};

function normalizeName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[.]/g, "")
    .replace(/\s+/g, " ");
}

const NAME_TO_CODE = new Map<string, string>();
for (const [code, name] of Object.entries(GST_STATE_NAMES)) {
  if (LEGACY_CODES.has(code)) continue;
  NAME_TO_CODE.set(normalizeName(name), code);
}
for (const [alias, code] of Object.entries(NAME_ALIASES)) {
  NAME_TO_CODE.set(normalizeName(alias), code);
}

/** Accepts "19", "9" or 19 and returns a canonical two-digit code. */
export function normalizeStateCode(
  input: string | number | null | undefined,
): string | null {
  if (input == null) return null;
  const digits = String(input).replace(/\D/g, "");
  if (!digits) return null;
  const padded = digits.padStart(2, "0");
  return GST_STATE_NAMES[padded] ? padded : null;
}

export function stateCodeFromName(
  name: string | null | undefined,
): string | null {
  if (!name) return null;
  return NAME_TO_CODE.get(normalizeName(name)) ?? null;
}

export function stateNameFromCode(
  code: string | null | undefined,
): string | null {
  const normalized = normalizeStateCode(code);
  return normalized ? (GST_STATE_NAMES[normalized] ?? null) : null;
}
