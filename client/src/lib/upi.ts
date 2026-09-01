// Builds a standard UPI deep-link (openable by any UPI app) for manual
// payment collection. No gateway involved — this is just a pre-filled intent.
export function buildUpiUri(input: {
  payeeVpa: string;
  payeeName: string;
  amount: number;
  note: string;
  refId: string;
}): string {
  const params = new URLSearchParams({
    pa: input.payeeVpa,
    pn: input.payeeName,
    am: input.amount.toFixed(2),
    cu: "INR",
    tn: input.note,
    tr: input.refId,
  });
  return `upi://pay?${params.toString()}`;
}
