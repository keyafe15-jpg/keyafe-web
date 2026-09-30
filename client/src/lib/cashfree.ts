import { load } from "@cashfreepayments/cashfree-js";
import type { PaymentSession } from "@/hooks/usePayments";

/**
 * Sends the browser to Cashfree's hosted checkout. Cashfree brings the
 * customer back to /order/:number/success when the payment settles, so on
 * success this never resolves in practice; it throws if the SDK can't start.
 */
export async function payWithCashfree(session: PaymentSession) {
  const cashfree = await load({ mode: session.mode });
  if (!cashfree) throw new Error("Couldn't open the payment page. Please try again.");

  const result = await cashfree.checkout({
    paymentSessionId: session.paymentSessionId,
    redirectTarget: "_self",
  });
  if (result?.error) {
    throw new Error(result.error.message ?? "Couldn't open the payment page. Please try again.");
  }
}
