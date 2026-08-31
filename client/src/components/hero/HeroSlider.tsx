import { useEffect, useState } from "react";

type HeroSlide = {
  title: string;
  description: string;
  tint: string;
  accent: string;
};

const slides: HeroSlide[] = [
  {
    title: "Fresh cakes",
    description:
      "Soft bakes, decadent fillings and the kind of finish that feels special from the first bite.",
    tint: "bg-brand-500/15",
    accent: "bg-brand-500",
  },
  {
    title: "Celebration moments",
    description:
      "Custom cakes and gifting treats designed to make cherished celebrations feel unforgettable.",
    tint: "bg-pink-200/30",
    accent: "bg-[#f088c1]",
  },
  {
    title: "Baker's picks",
    description:
      "A rotating selection of bestsellers, seasonal favourites and warm everyday indulgences.",
    tint: "bg-[#f5ecd6]",
    accent: "bg-[#d59d50]",
  },
];

export function HeroSlider() {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  const goToPrevious = () => {
    setSelectedIndex(
      (current) => (current - 1 + slides.length) % slides.length,
    );
  };

  const goToNext = () => {
    setSelectedIndex((current) => (current + 1) % slides.length);
  };

  const goToSlide = (index: number) => {
    setSelectedIndex(index);
  };

  useEffect(() => {
    const autoplay = window.setInterval(() => {
      setSelectedIndex((current) => (current + 1) % slides.length);
    }, 4200);

    return () => {
      window.clearInterval(autoplay);
    };
  }, []);

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    setTouchStartX(event.touches[0]?.clientX ?? null);
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartX === null) return;

    const touchEndX = event.changedTouches[0]?.clientX ?? touchStartX;
    const delta = touchEndX - touchStartX;

    if (Math.abs(delta) > 40) {
      if (delta < 0) {
        goToNext();
      } else {
        goToPrevious();
      }
    }

    setTouchStartX(null);
  };

  return (
    <div className="hero-showcase w-full max-w-full min-w-0 rounded-[2.1rem] border border-[#eadfc8] bg-[#f7f2eb]/90 p-4 shadow-[0_20px_45px_rgba(21,31,37,0.06)] backdrop-blur-sm">
      <div className="hero-carousel-wrap w-full max-w-full min-w-0 overflow-hidden rounded-[1.7rem] border border-[#eadfc8] bg-[#f5f2ee] p-1 sm:p-2">
        <div
          className="w-full max-w-full min-w-0 overflow-hidden"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div
            className="flex w-full min-w-0 transition-transform duration-500 ease-out"
            style={{ transform: `translateX(-${selectedIndex * 100}%)` }}
          >
            {slides.map((slide) => (
              <div
                key={slide.title}
                className="min-w-0 w-full shrink-0 p-0.5"
                style={{ flex: "0 0 100%" }}
              >
                <div className="showcase-stage relative overflow-hidden rounded-[1.4rem] border border-[#eadfc8] bg-[#f4f0eb] p-3 sm:p-4">
                  <div className={`absolute inset-0 ${slide.tint}`} />
                  <div className="relative flex h-[130px] items-end justify-between gap-2 sm:h-[310px] md:h-[310px] lg:h-[330px]">
                    <div className="min-w-0 max-w-[62%] flex-1">
                      <p
                        className={`mb-1.5 inline-flex rounded-full px-2.5 py-1 text-[8px] font-semibold uppercase tracking-[0.18em] text-white sm:mb-2 sm:text-[9px] ${slide.accent}`}
                      >
                        Fresh picks
                      </p>
                      <h2 className="text-[1.35rem] font-bold leading-[1.02] text-ink-900 sm:text-[1.8rem] md:text-3xl">
                        {slide.title}
                      </h2>
                      <p className="mt-1 hidden text-sm leading-6 text-ink-700 sm:mt-2 sm:block">
                        {slide.description}
                      </p>
                    </div>

                    <div className="relative h-16 w-16 shrink-0 rounded-full border border-brand-200 bg-white/90 shadow-[0_15px_30px_rgba(227,28,121,0.12)] sm:h-32 sm:w-32">
                      <div className="absolute inset-2.5 rounded-full bg-gradient-to-br from-brand-100 to-brand-300/80 blur-sm sm:inset-3" />
                      <div className="absolute inset-3 flex items-center justify-center rounded-full bg-white text-xl shadow-sm sm:inset-4 sm:text-4xl">
                        {slide.title.includes("Fresh")
                          ? "🧁"
                          : slide.title.includes("Celebration")
                            ? "🎂"
                            : "🍪"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          {slides.map((slide, index) => (
            <button
              type="button"
              key={slide.title}
              onClick={() => goToSlide(index)}
              aria-label={`Go to slide ${index + 1}`}
              className={`h-2 rounded-full transition-all ${
                index === selectedIndex
                  ? "w-8 bg-brand-500"
                  : "w-2 bg-brand-200 hover:bg-brand-300"
              }`}
            />
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goToPrevious}
            aria-label="Previous slide"
            className="flex h-7 w-7 items-center justify-center rounded-full border border-[#eadfc8] bg-white/80 text-sm text-ink-700 transition hover:border-brand-300 hover:text-brand-500"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={goToNext}
            aria-label="Next slide"
            className="flex h-7 w-7 items-center justify-center rounded-full border border-[#eadfc8] bg-white/80 text-sm text-ink-700 transition hover:border-brand-300 hover:text-brand-500"
          >
            ›
          </button>
        </div>
      </div>
    </div>
  );
}
