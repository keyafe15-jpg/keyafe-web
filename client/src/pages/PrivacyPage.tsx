import { Mail, Phone } from "lucide-react";
import { Seo } from "@/components/seo/Seo";
import { useStoreProfile } from "@/hooks/useStoreProfile";
import { trackContactClick } from "@/lib/analytics";

const LAST_UPDATED = "5 October 2026";

function PolicySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-card border border-cream-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="font-display text-xl text-ink-900">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-6 text-ink-700">{children}</div>
    </section>
  );
}

export function PrivacyPage() {
  const contact = useStoreProfile();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Seo
        title="Privacy policy"
        description={`How ${contact.name} uses the details you share when you order, and how we measure visits to our website.`}
      />

      <p className="text-sm font-medium tracking-[0.2em] text-brand-500 uppercase">Policies</p>
      <h1 className="mt-2 font-display text-3xl text-ink-900 md:text-4xl">Privacy policy</h1>
      <p className="mt-3 text-sm leading-6 text-ink-700">
        We only ask for what we need to bake and deliver your order, and we never sell your details.
      </p>
      <p className="mt-1 text-xs text-ink-500">Last updated {LAST_UPDATED}</p>

      <div className="mt-8 space-y-4">
        <PolicySection title="What we collect when you order">
          <p>
            Your name, phone number and email, the delivery address and recipient details, and
            anything you add to the order such as a message on the cake or a reference photo. For
            business orders we also keep your company name and GSTIN for the invoice.
          </p>
          <p>
            Online payments are handled by our payment partner. We never see or store your card, UPI
            or bank details.
          </p>
        </PolicySection>

        <PolicySection title="How we use it">
          <p>
            To prepare and deliver your order, contact you about it, send your confirmation and
            invoice, and keep the tax records the law requires. Your name, phone number and address
            are shared with the rider delivering your order.
          </p>
        </PolicySection>

        <PolicySection title="Website analytics and cookies">
          <p>
            We use Google Analytics to understand how people use our website, for example how many
            visitors we get, which pages and products they look at, and where they came from. It
            uses cookies and gives us totals and trends, not your name, phone number or address.
          </p>
          <p>
            Your cart and sign-in are also kept in your browser so they&apos;re still there when you
            come back. You can clear cookies and site data in your browser settings at any time, or
            block analytics with a browser extension. The shop works the same either way.
          </p>
        </PolicySection>

        <PolicySection title="Your choices">
          <p>
            You can ask us to show, correct or delete the details we hold about you. Orders we need
            to keep for tax purposes stay on record, but we won&apos;t use them for anything else.
          </p>
          <div className="grid gap-2 pt-1 sm:grid-cols-2">
            <a
              href={`mailto:${contact.email}`}
              className="flex items-center gap-2 rounded-lg border border-cream-200 px-3 py-2.5 text-ink-900 transition hover:border-brand-300"
            >
              <Mail className="h-4 w-4 shrink-0 text-brand-500" />
              <span className="min-w-0 truncate">{contact.email}</span>
            </a>
            <a
              href={`tel:${contact.phoneHref}`}
              onClick={() => trackContactClick("phone", "privacy_policy")}
              className="flex items-center gap-2 rounded-lg border border-cream-200 px-3 py-2.5 text-ink-900 transition hover:border-brand-300"
            >
              <Phone className="h-4 w-4 shrink-0 text-brand-500" />
              {contact.phone}
            </a>
          </div>
        </PolicySection>
      </div>
    </div>
  );
}
