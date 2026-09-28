import { ABOUT_BANNER, KEYAFE_FOUNDED_YEAR } from "@/content/about";

const stats = [
  `Since ${KEYAFE_FOUNDED_YEAR}`,
  "Belur, Howrah",
  "Kolkata · Howrah · Hooghly",
  "Family-led",
];

export function AboutBanner() {
  return (
    <section className="mx-auto max-w-6xl sm:px-4 sm:pt-6">
      <div className="relative h-[62svh] max-h-[560px] min-h-[420px] overflow-hidden bg-ink-900 sm:h-[68svh] sm:max-h-[620px] sm:rounded-[2rem]">
        <img
          src={ABOUT_BANNER.image}
          alt={ABOUT_BANNER.alt}
          fetchPriority="high"
          style={{ objectPosition: ABOUT_BANNER.focus }}
          className="collection-ken absolute inset-0 h-full w-full object-cover"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-ink-900/90 via-ink-900/35 to-ink-900/10"
        />

        <span className="home-rise absolute top-4 right-4 border border-white/30 bg-white/10 px-3 py-1 text-[10px] font-medium tracking-[0.22em] text-white uppercase backdrop-blur-md sm:top-6 sm:right-6 sm:text-xs">
          {ABOUT_BANNER.caption}
        </span>

        <div className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-10 md:p-12">
          <p
            className="home-rise text-[11px] font-medium tracking-[0.28em] text-brand-100 uppercase sm:text-sm"
            style={{ animationDelay: "120ms" }}
          >
            About Keyafe
          </p>
          <h1
            className="home-rise mt-2 max-w-2xl text-3xl leading-tight text-white sm:mt-3 sm:text-5xl md:text-6xl"
            style={{ animationDelay: "240ms" }}
          >
            A sweet story, grown from our family kitchen.
          </h1>
          <p
            className="home-rise mt-3 max-w-xl text-sm leading-6 text-white/85 sm:mt-4 sm:text-base sm:leading-7"
            style={{ animationDelay: "380ms" }}
          >
            What began on 16 December 2019 in Belur, Howrah, has grown into a heartfelt bakery built
            with love, patience and a lot of togetherness.
          </p>
          <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 sm:mt-6 sm:gap-x-6">
            {stats.map((stat, index) => (
              <li
                key={stat}
                className="home-pill flex items-center gap-2 text-[11px] font-medium tracking-[0.12em] text-white/90 uppercase sm:text-xs"
                style={{ animationDelay: `${520 + index * 90}ms` }}
              >
                <span aria-hidden className="size-1 rotate-45 bg-amber-200" />
                {stat}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
