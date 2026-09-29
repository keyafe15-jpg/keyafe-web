import { Link } from "react-router-dom";
import { AboutBanner } from "@/components/about/AboutBanner";
import { BirthdayCelebrations } from "@/components/about/BirthdayCelebrations";
import { MomentsMarquee } from "@/components/about/MomentsMarquee";
import { PageMotifs } from "@/components/decor/PageMotifs";
import { SlideCarousel } from "@/components/ui/SlideCarousel";

const timeline = [
  {
    year: "2019",
    title: "A small idea, baked with intention",
    body: "Keyafe was born in Belur, Howrah, as a family dream built around joyful celebration cakes, fresh bakes, and honest service.",
  },
  {
    year: "2020-2023",
    title: "From home kitchen to growing community",
    body: "We began with a small but deeply personal touch — handcrafted cakes, cookies, brownies, cheesecake and custom celebration boxes made for families and small gatherings.",
  },
  {
    year: "Today",
    title: "A growing bakery with a family heartbeat",
    body: "Today, Keyafe delivers across Kolkata, Howrah and Hooghly, bringing handmade joy to birthdays, anniversaries, gifting moments and everyday sweet cravings.",
  },
];

const makers = [
  {
    name: "Srijita Thakur",
    role: "Founder • Full-stack developer • dreamer",
    image: "/srijita2.jpg",
    description:
      "I am Srijita Thakur — the founder, builder of this website, and a full-stack developer who wanted Keyafe to feel as warm and personal as the food itself.",
  },
  {
    name: "Subrata Thakur",
    role: "The backbone of our logistics & delivery",
    image: "/subratathakur2.jpg",
    description:
      "At 68, my father is the pillar of this business — he manages delivery, operations, and the unseen chaos behind every smooth order.",
  },
  {
    name: "Keya Thakur",
    role: "Family support • sweet-thinking partner",
    image: "/keyathakur.jpg",
    description:
      "Keya brings warmth, care and constant support to the work behind every celebration and every batch of freshly baked treats.",
  },
  {
    name: "Souvik Thakur",
    role: "A steady hand in the family journey",
    image: "/souvikthakur.jpg",
    description:
      "Souvik stands with the family in building Keyafe with love, patience and belief in the work we do together.",
  },
  {
    name: "Alpana Manna",
    role: "Home chef • Cake artist and dessert specialist",
    image: "/alpana.jpg",
    description:
      "A self-taught home cook who grew with us over the years, now creating beautiful bakes with skill, consistency and devotion.",
  },
  {
    name: "Tamasha Ghosh",
    role: "Home chef • Savoury and fondant work specialist",
    image: "/tamasha.jpg",
    description:
      "Tamasha came from humble beginnings and grew stronger with us — now a trusted part of our kitchen and a key reason our desserts feel so personal.",
  },
];

const principles = [
  {
    title: "Handmade with heart",
    text: "Every order is made with care, not mass production — because a celebration should feel personal.",
  },
  {
    title: "Built on family values",
    text: "We work like a family, grow like a team, and treat every customer like one of our own.",
  },
  {
    title: "Service without stress",
    text: "We manage our own deliveries and keep the experience warm, timely and dependable across our service areas.",
  },
];

function TimelineCard({ item }: { item: (typeof timeline)[number] }) {
  return (
    <div className="h-full rounded-[1.5rem] border border-cream-200 bg-white p-5 shadow-sm md:p-6">
      <p className="text-sm font-semibold tracking-[0.18em] text-brand-500 uppercase">
        {item.year}
      </p>
      <h3 className="mt-3 text-xl text-ink-900 md:mt-4 md:text-2xl">{item.title}</h3>
      <p className="mt-2.5 text-sm leading-6 text-ink-700 md:mt-3 md:text-base md:leading-7">
        {item.body}
      </p>
    </div>
  );
}

function PrincipleCard({ principle }: { principle: (typeof principles)[number] }) {
  return (
    <div className="from-brand-50 h-full rounded-[1.5rem] border border-brand-100 bg-gradient-to-br to-white p-5 md:p-6">
      <h3 className="text-xl text-ink-900 md:text-2xl">{principle.title}</h3>
      <p className="mt-2.5 text-sm leading-6 text-ink-700 md:mt-3 md:text-base md:leading-7">
        {principle.text}
      </p>
    </div>
  );
}

export function AboutPage() {
  return (
    <div className="relative isolate overflow-hidden pb-20">
      <PageMotifs />

      <AboutBanner />

      <section className="mx-auto mt-14 max-w-6xl px-4 md:mt-20">
        <div className="mb-6 max-w-2xl md:mb-8">
          <p className="text-sm font-medium tracking-[0.2em] text-brand-500 uppercase">Our story</p>
          <h2 className="mt-2 text-3xl text-ink-900 md:text-5xl">
            Built on love, learning and a lot of practice.
          </h2>
        </div>

        <SlideCarousel
          ariaLabel="Our story"
          hideFrom="md"
          slideClassName="w-[88%]"
          snapAlign="start"
        >
          {timeline.map((item) => (
            <TimelineCard key={item.year} item={item} />
          ))}
        </SlideCarousel>

        <div className="hidden gap-5 md:grid md:grid-cols-3">
          {timeline.map((item) => (
            <TimelineCard key={item.year} item={item} />
          ))}
        </div>
      </section>

      <BirthdayCelebrations />

      <section className="mx-auto mt-14 max-w-6xl px-4 md:mt-20">
        <div className="mb-6 flex items-end justify-between gap-4 md:mb-8">
          <div>
            <p className="text-sm font-medium tracking-[0.2em] text-brand-500 uppercase">
              The people behind Keyafe
            </p>
            <h2 className="mt-2 text-3xl text-ink-900 md:text-5xl">
              Family, grit and growing together.
            </h2>
          </div>
        </div>

        <SlideCarousel
          ariaLabel="The people behind Keyafe"
          snapAlign="start"
          autoPlayMs={6000}
          slideClassName="w-[min(85%,20rem)] sm:w-[calc((100%-0.75rem)/2)] lg:w-[calc((100%-1.5rem)/3)]"
        >
          {makers.map((person) => (
            <article
              key={person.name}
              className="flex h-full flex-col overflow-hidden rounded-[1.25rem] border border-cream-200 bg-white shadow-sm"
            >
              <img
                src={person.image}
                alt={person.name}
                loading="lazy"
                className="aspect-[4/3] w-full object-cover object-[center_40%]"
              />
              <div className="flex-1 p-4 sm:p-5">
                <h3 className="text-xl text-ink-900">{person.name}</h3>
                <p className="mt-1 text-[11px] font-medium tracking-[0.14em] text-brand-500 uppercase">
                  {person.role}
                </p>
                <p className="mt-2.5 text-sm leading-6 text-ink-700">{person.description}</p>
              </div>
            </article>
          ))}
        </SlideCarousel>
      </section>

      <MomentsMarquee />

      <section className="mx-auto mt-14 max-w-6xl px-4 md:mt-20">
        <SlideCarousel
          ariaLabel="What we stand for"
          hideFrom="md"
          slideClassName="w-[88%]"
          snapAlign="start"
        >
          {principles.map((principle) => (
            <PrincipleCard key={principle.title} principle={principle} />
          ))}
        </SlideCarousel>

        <div className="hidden gap-5 md:grid md:grid-cols-3">
          {principles.map((principle) => (
            <PrincipleCard key={principle.title} principle={principle} />
          ))}
        </div>
      </section>

      <section className="mx-auto mt-14 max-w-5xl px-4 md:mt-20">
        <div className="via-ink-800 rounded-[2rem] bg-gradient-to-r from-ink-900 to-brand-700 p-6 text-white sm:p-8 md:p-12">
          <p className="text-sm font-medium tracking-[0.2em] text-brand-100 uppercase">
            Thank you for being part of our journey
          </p>
          <h2 className="mt-3 max-w-2xl text-2xl sm:text-3xl md:text-5xl">
            We hope you will support Keyafe as we continue to grow, learn and bring joy to more
            homes.
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-cream-50 sm:mt-5 sm:text-base">
            From our family to yours, every order is a little story of trust, care and celebration.
            We’re grateful for every smile, every feedback and every chance to make your moments
            sweeter.
          </p>
          <div className="mt-7 flex flex-wrap gap-4">
            <Link
              to="/get-quote"
              className="rounded-full bg-white px-6 py-3 text-sm font-medium text-ink-900 transition hover:bg-cream-100"
            >
              Plan your celebration
            </Link>
            <Link
              to="/"
              className="rounded-full border border-white/60 px-6 py-3 text-sm font-medium text-white transition hover:bg-white/10"
            >
              Back to home
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
