import { Link } from "react-router-dom";
import { Mail, MessageCircle, Phone } from "lucide-react";
import { Seo } from "@/components/seo/Seo";
import { BRAND } from "@/content/brand";

/** Must match CUSTOMER_CANCEL_CUTOFF_HOURS in server/src/modules/orders/order.cancel.ts. */
const CANCEL_CUTOFF_HOURS = 4;
const LAST_UPDATED = "30 September 2026";

const telHref = (phone: string) => `tel:${phone.replace(/\s/g, "")}`;

function PolicySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-card border border-cream-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="font-display text-xl text-ink-900">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-6 text-ink-700">{children}</div>
    </section>
  );
}

export function CancellationPolicyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Seo
        title="Cancellation & refund policy"
        description={`${BRAND.name} bakes every order fresh. Read how cancellations, refunds and order changes work.`}
      />

      <p className="text-sm font-medium tracking-[0.2em] text-brand-500 uppercase">Policies</p>
      <h1 className="mt-2 font-display text-3xl text-ink-900 md:text-4xl">
        Cancellation &amp; refund policy
      </h1>
      <p className="mt-3 text-sm leading-6 text-ink-700">
        Everything we make is baked fresh for your order, so here&apos;s how returns, cancellations
        and changes work.
      </p>
      <p className="mt-1 text-xs text-ink-500">Last updated {LAST_UPDATED}</p>

      <div className="mt-8 space-y-4">
        <PolicySection title="No returns or exchanges">
          <p>
            Our cakes and bakes are perishable and made to order, so we can&apos;t accept returns or
            exchanges once your order has been delivered or picked up.
          </p>
          <p>
            If something doesn&apos;t look right when your order arrives, please call us straight
            away so we can look into it.
          </p>
        </PolicySection>

        <PolicySection title="Cancelling an order">
          <p>
            You can cancel your order as long as we haven&apos;t started preparing it. Preparation
            begins {CANCEL_CUTOFF_HOURS} hours before your delivery or pickup slot, so{" "}
            <strong className="font-semibold text-ink-900">
              cancellations close {CANCEL_CUTOFF_HOURS} hours before your slot starts
            </strong>
            .
          </p>
          <p>
            For example, if your slot starts at 4 PM, you can cancel until 12 noon that day. After
            that, the order can&apos;t be cancelled.
          </p>
          <p>
            To cancel, open your order from the confirmation email or{" "}
            <Link to="/my-orders" className="text-brand-600 font-medium hover:text-brand-700">
              My orders
            </Link>{" "}
            and tap <span className="font-medium">Cancel order</span>, or call us.
          </p>
        </PolicySection>

        <PolicySection title="Refunds for cancelled orders">
          <p>
            If you paid online and cancel in time, we refund the full amount to your original
            payment method. Banks usually take 5–7 working days to show the refund.
          </p>
          <p>For pay-on-delivery orders, there&apos;s nothing to refund.</p>
        </PolicySection>

        <PolicySection title="Changing your order">
          <p>
            Need to change the date, time slot, address, message on the cake or anything else? Email
            or call us and we&apos;ll do our best to help, as long as preparation hasn&apos;t
            started.
          </p>
          <div className="grid gap-2 pt-1 sm:grid-cols-3">
            <a
              href={`mailto:${BRAND.supportEmail}`}
              className="flex items-center gap-2 rounded-lg border border-cream-200 px-3 py-2.5 text-ink-900 transition hover:border-brand-300"
            >
              <Mail className="h-4 w-4 shrink-0 text-brand-500" />
              <span className="min-w-0 truncate">{BRAND.supportEmail}</span>
            </a>
            <a
              href={telHref(BRAND.supportPhone)}
              className="flex items-center gap-2 rounded-lg border border-cream-200 px-3 py-2.5 text-ink-900 transition hover:border-brand-300"
            >
              <Phone className="h-4 w-4 shrink-0 text-brand-500" />
              {BRAND.supportPhone}
            </a>
            <a
              href={BRAND.socials.whatsapp}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-lg border border-cream-200 px-3 py-2.5 text-ink-900 transition hover:border-brand-300"
            >
              <MessageCircle className="h-4 w-4 shrink-0 text-brand-500" />
              WhatsApp us
            </a>
          </div>
          <p className="text-xs text-ink-500">
            You can also reach us on{" "}
            <a href={telHref(BRAND.altPhone)} className="font-medium text-ink-700">
              {BRAND.altPhone}
            </a>
            .
          </p>
        </PolicySection>
      </div>
    </div>
  );
}
