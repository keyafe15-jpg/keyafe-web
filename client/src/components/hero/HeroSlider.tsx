import { useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";

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
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: true, align: "center" },
    [Autoplay({ delay: 4200, stopOnInteraction: false })],
  );
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (!emblaApi) return;

    const onSelect = () => {
      setSelectedIndex(emblaApi.selectedScrollSnap());
    };

    onSelect();
    emblaApi.on("select", onSelect);

    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi]);

  const goToPrevious = () => {
    emblaApi?.scrollPrev();
  };

  const goToNext = () => {
    emblaApi?.scrollNext();
  };

  const goToSlide = (index: number) => {
    emblaApi?.scrollTo(index);
  };

  return (
    <div className="hero-showcase w-full rounded-[2.1rem] border border-[#eadfc8] bg-[#f7f2eb]/90 p-4 shadow-[0_20px_45px_rgba(21,31,37,0.06)] backdrop-blur-sm">
      <div className="hero-carousel-wrap overflow-hidden rounded-[1.7rem] border border-[#eadfc8] bg-[#f5f2ee] p-1 sm:p-2">
        <div className="embla__viewport overflow-hidden" ref={emblaRef}>
          <div className="embla__container flex">
            {slides.map((slide) => (
              <div
                key={slide.title}
                className="embla__slide min-w-0 flex-[0_0_100%] p-0.5"
              >
                <div className="showcase-stage relative overflow-hidden rounded-[1.4rem] border border-[#eadfc8] bg-[#f4f0eb] p-3 sm:p-4">
                  <div className={`absolute inset-0 ${slide.tint}`} />
                  <div className="relative flex h-[130px] items-end justify-between gap-3 sm:h-[310px] lg:h-[330px] md:h-[310px]">
                    <div className="max-w-[62%]">
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
