/** wa.me link; 10-digit numbers are treated as Indian mobiles. */
export function whatsappHref(phone: string, text?: string) {
  const digits = phone.replace(/\D/g, "");
  const withCountry = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${withCountry}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}
