import { Link } from "react-router-dom";
import { PageMotifs } from "@/components/decor/PageMotifs";

const storyPillars = [
  "Founded on 16 December 2019",
  "Based in Belur, Howrah",
  "Serving Kolkata, Howrah & Hooghly",
  "Family-led, home-baked with heart",
];

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
    image:
      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=900&q=80",
    description:
      "I am Srijita Thakur — the founder, builder of this website, and a full-stack developer who wanted Keyafe to feel as warm and personal as the food itself.",
  },
  {
    name: "Subrata Thakur",
    role: "The backbone of our logistics & delivery",
    image:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=900&q=80",
    description:
      "At 68, my father is the pillar of this business — he manages delivery, operations, and the unseen chaos behind every smooth order.",
  },
  {
    name: "Keya Thakur",
    role: "Family support • sweet-thinking partner",
    image:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=900&q=80",
    description:
      "Keya brings warmth, care and constant support to the work behind every celebration and every batch of freshly baked treats.",
  },
  {
    name: "Souvik Thakur",
    role: "A steady hand in the family journey",
    image:
      "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=900&q=80",
    description:
      "Souvik stands with the family in building Keyafe with love, patience and belief in the work we do together.",
  },
  {
    name: "Alpana Manna",
    role: "Home chef • cake artist",
    image:
      "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=900&q=80",
    description:
      "A self-taught home cook who grew with us over the years, now creating beautiful bakes with skill, consistency and devotion.",
  },
  {
    name: "Tamasha Ghosh",
    role: "Home chef • dessert specialist",
    image:
      "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=80",
    description:
      "Tamasha came from humble beginnings and grew stronger with us — now a trusted part of our kitchen and a key reason our desserts feel so personal.",
  },
];

const productHighlights = [
  "Eggless cakes",
  "Pizzas",
  "Cookies",
  "Brownies",
  "Cheesecakes",
  "Custom celebration cakes",
  "Small & large occasion orders",
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

export function AboutPage() {
  return (
    <div className="relative isolate overflow-hidden pb-20">
      <PageMotifs />

      <section className="mx-auto max-w-6xl px-4 pt-14 md:pt-20">
        <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <p className="mb-3 text-sm font-medium uppercase tracking-[0.22em] text-brand-500">
              About Keyafe
            </p>
            <h1 className="max-w-xl text-4xl leading-tight text-ink-900 md:text-6xl">
              A sweet story, grown from our family kitchen.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-8 text-ink-700 md:text-lg">
              What began on 16 December 2019 in Belur, Howrah, has grown into a
              heartfelt bakery and dessert studio built with love, patience and
              a lot of togetherness.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              {storyPillars.map((pill) => (
                <span
                  key={pill}
                  className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700"
                >
                  {pill}
                </span>
              ))}
            </div>

            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                to="/get-quote"
                className="rounded-full bg-brand-500 px-6 py-3 text-sm font-medium text-white transition hover:bg-brand-700"
              >
                Request a custom order
              </Link>
              <Link
                to="/same-day"
                className="rounded-full border border-ink-700 px-6 py-3 text-sm font-medium text-ink-700 transition hover:bg-cream-100"
              >
                Explore fresh picks
              </Link>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="overflow-hidden rounded-[1.5rem] border border-cream-200 bg-white shadow-sm sm:translate-y-6">
              <img
                src="https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=900&q=80"
                alt="Celebration cake on a table"
                className="h-[360px] w-full object-cover"
              />
            </div>
            <div className="space-y-4">
              <div className="overflow-hidden rounded-[1.5rem] border border-cream-200 bg-white shadow-sm">
                <img
                  src="https://images.unsplash.com/photo-1517433670267-08bbd4be890f?auto=format&fit=crop&w=900&q=80"
                  alt="Freshly baked cookies and pastries"
                  className="h-[170px] w-full object-cover"
                />
              </div>
              <div className="rounded-[1.5rem] border border-brand-200 bg-gradient-to-br from-brand-50 to-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-700">
                  Our promise
                </p>
                <p className="mt-3 text-2xl font-semibold text-ink-900">
                  From our kitchen to your celebration.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto mt-20 max-w-6xl px-4">
        <div className="mb-8 max-w-2xl">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-brand-500">
            Our story
          </p>
          <h2 className="mt-2 text-3xl text-ink-900 md:text-5xl">
            Built on love, learning and a lot of practice.
          </h2>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {timeline.map((item) => (
            <div
              key={item.year}
              className="rounded-[1.5rem] border border-cream-200 bg-white p-6 shadow-sm"
            >
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-500">
                {item.year}
              </p>
              <h3 className="mt-4 text-2xl text-ink-900">{item.title}</h3>
              <p className="mt-3 leading-7 text-ink-700">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-20 max-w-6xl px-4">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-brand-500">
              The people behind Keyafe
            </p>
            <h2 className="mt-2 text-3xl text-ink-900 md:text-5xl">
              Family, grit and growing together.
            </h2>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {makers.map((person) => (
            <article
              key={person.name}
              className="overflow-hidden rounded-[1.5rem] border border-cream-200 bg-white shadow-sm"
            >
              <img
                src={person.image}
                alt={person.name}
                className="h-64 w-full object-cover"
              />
              <div className="p-5">
                <h3 className="text-2xl text-ink-900">{person.name}</h3>
                <p className="mt-1 text-sm font-medium uppercase tracking-[0.15em] text-brand-500">
                  {person.role}
                </p>
                <p className="mt-3 leading-7 text-ink-700">
                  {person.description}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-20 max-w-6xl px-4">
        <div className="grid gap-8 rounded-[2rem] border border-cream-200 bg-white p-6 shadow-sm lg:grid-cols-[0.9fr_1.1fr] lg:p-8">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-brand-500">
              What we make
            </p>
            <h2 className="mt-2 text-3xl text-ink-900 md:text-5xl">
              Bakes for every little celebration and every big milestone.
            </h2>
          </div>

          <div className="flex flex-wrap gap-3">
            {productHighlights.map((item) => (
              <span
                key={item}
                className="rounded-full bg-cream-100 px-4 py-2 text-sm font-medium text-ink-700"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto mt-20 max-w-6xl px-4">
        <div className="grid gap-5 md:grid-cols-3">
          {principles.map((principle) => (
            <div
              key={principle.title}
              className="rounded-[1.5rem] border border-brand-100 bg-gradient-to-br from-brand-50 to-white p-6"
            >
              <h3 className="text-2xl text-ink-900">{principle.title}</h3>
              <p className="mt-3 leading-7 text-ink-700">{principle.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-20 max-w-5xl px-4">
        <div className="rounded-[2rem] bg-gradient-to-r from-ink-900 via-ink-800 to-brand-700 p-8 text-white md:p-12">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-brand-100">
            Thank you for being part of our journey
          </p>
          <h2 className="mt-3 max-w-2xl text-3xl md:text-5xl">
            We hope you will support Keyafe as we continue to grow, learn and
            bring joy to more homes.
          </h2>
          <p className="mt-5 max-w-2xl text-base leading-7 text-cream-50">
            From our family to yours, every order is a little story of trust,
            care and celebration. We’re grateful for every smile, every feedback
            and every chance to make your moments sweeter.
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
