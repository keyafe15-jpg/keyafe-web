import { useState, type CSSProperties } from "react";
import { Reveal } from "@/components/motion/Reveal";
import {
  ABOUT_BIRTHDAY_COPY,
  ABOUT_BIRTHDAYS,
  KEYAFE_FOUNDED_YEAR,
  type BirthdayCelebration,
} from "@/content/about";
import { AboutMediaTile } from "@/components/about/AboutMediaTile";
import { cn } from "@/lib/cn";

const TILTS = ["-5deg", "3.5deg", "-2deg", "5deg", "-3.5deg", "2deg"];

function ordinal(n: number) {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  return `${n}${{ 1: "st", 2: "nd", 3: "rd" }[n % 10] ?? "th"}`;
}

export function BirthdayCelebrations() {
  const [year, setYear] = useState(ABOUT_BIRTHDAYS[0]?.year);
  const current = ABOUT_BIRTHDAYS.find((b) => b.year === year) ?? ABOUT_BIRTHDAYS[0];
  if (!current) return null;

  return (
    <section className="relative mx-auto mt-14 max-w-6xl px-4 md:mt-20">
      <Reveal>
        <div className="max-w-2xl">
          <p className="text-sm font-medium tracking-[0.2em] text-brand-500 uppercase">
            {ABOUT_BIRTHDAY_COPY.eyebrow}
          </p>
          <h2 className="mt-2 text-3xl text-ink-900 md:text-5xl">{ABOUT_BIRTHDAY_COPY.title}</h2>
          <p className="mt-3 text-sm leading-7 text-ink-700 md:mt-4 md:text-base">
            {ABOUT_BIRTHDAY_COPY.body}
          </p>
        </div>
      </Reveal>

      {ABOUT_BIRTHDAYS.length > 1 && (
        <div
          role="tablist"
          aria-label="Celebration year"
          className="mt-6 flex [scrollbar-width:none] gap-2 overflow-x-auto pb-1 md:mt-8"
        >
          {ABOUT_BIRTHDAYS.map((b) => (
            <button
              key={b.year}
              type="button"
              role="tab"
              aria-selected={b.year === current.year}
              onClick={() => setYear(b.year)}
              className={cn(
                "shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition",
                b.year === current.year
                  ? "border-brand-500 bg-brand-500 text-white shadow-[0_8px_20px_rgba(227,28,121,0.25)]"
                  : "border-cream-200 bg-white text-ink-700 hover:border-brand-300",
              )}
            >
              {b.year}
            </button>
          ))}
        </div>
      )}

      <CelebrationYear key={current.year} celebration={current} />
    </section>
  );
}

function CelebrationYear({ celebration }: { celebration: BirthdayCelebration }) {
  const birthday = celebration.year - KEYAFE_FOUNDED_YEAR;

  return (
    <div className="relative mt-6 grid items-center gap-8 md:mt-8 lg:grid-cols-[0.8fr_1.2fr]">
      <span
        aria-hidden
        className="about-year-ghost pointer-events-none absolute -top-6 right-0 font-display text-[7rem] leading-none text-transparent select-none md:-top-10 md:text-[11rem] lg:right-auto lg:left-0"
      >
        {celebration.year}
      </span>

      <div className="about-year-in relative">
        <p className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold tracking-[0.14em] text-amber-900 uppercase">
          <span aria-hidden className="about-candle" />
          {ordinal(birthday)} birthday
        </p>
        <h3 className="mt-3 text-2xl text-ink-900 md:text-3xl">{celebration.place}</h3>
        <p className="mt-2 text-sm leading-7 text-ink-700 md:text-base">{celebration.note}</p>
      </div>

      <div className="relative flex flex-wrap justify-center px-1 py-2 sm:px-4">
        {celebration.photos.map((photo, index) => (
          <figure
            key={photo.src}
            className="about-polaroid relative -mx-1.5 my-1.5 w-[48%] bg-white p-1.5 pb-7 shadow-[0_12px_30px_rgba(26,22,20,0.16)] sm:-mx-3 sm:my-2 sm:w-44 sm:p-2 sm:pb-9"
            style={
              {
                "--tilt": TILTS[index % TILTS.length],
                animationDelay: `${index * 110}ms`,
              } as CSSProperties
            }
          >
            <div className="aspect-square overflow-hidden bg-cream-100">
              <AboutMediaTile media={photo} />
            </div>
            {photo.caption && (
              <figcaption className="absolute inset-x-2 bottom-1.5 truncate text-center font-display text-[11px] text-ink-700 italic sm:bottom-2.5 sm:text-sm">
                {photo.caption}
              </figcaption>
            )}
          </figure>
        ))}
      </div>
    </div>
  );
}
