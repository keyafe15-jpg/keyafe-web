// GST state codes. Kept in sync with server/src/lib/indiaStates.ts.
// The seller's own code (from the registered address) is what the server
// compares a delivery state against to decide CGST+SGST versus IGST.

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

// Retired by reorganisation — still parsed, never offered as a choice.
const LEGACY_CODES = new Set(["25", "28", "97"]);

export const SELECTABLE_STATES: { code: string; name: string }[] = Object.entries(GST_STATE_NAMES)
  .filter(([code]) => !LEGACY_CODES.has(code))
  .map(([code, name]) => ({ code, name }))
  .sort((a, b) => a.name.localeCompare(b.name));

export function stateNameFromCode(code: string | null | undefined): string | null {
  if (!code) return null;
  const padded = String(code).replace(/\D/g, "").padStart(2, "0");
  return GST_STATE_NAMES[padded] ?? null;
}
