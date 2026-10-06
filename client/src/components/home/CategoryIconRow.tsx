import { useMemo, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { useCategories, useDepartments, type Department } from "@/hooks/useCategories";
import { categoryIcon } from "@/lib/categoryIcon";
import { HOME_COPY } from "@/content/home";

const FALLBACK_PALETTE = { accentHex: "#E31C79", softHex: "#F8D7E6", deepHex: "#B0155F" };

/** Round shortcut per top-level category, coloured by the store it belongs to. */
export function CategoryIconRow() {
  const { data: categories = [] } = useCategories();
  const { data: departments = [] } = useDepartments();

  const paletteById = useMemo(
    () => new Map<string, Department>(departments.map((d) => [d.id, d])),
    [departments],
  );

  if (categories.length === 0) return null;

  return (
    <nav aria-label={HOME_COPY.categoryRow.heading} className="mx-auto max-w-6xl px-4 pt-2 pb-3">
      <h2 className="sr-only">{HOME_COPY.categoryRow.heading}</h2>
      <ul className="-mx-4 flex snap-x scroll-px-4 [scrollbar-width:none] gap-3 overflow-x-auto px-4 py-1 [-ms-overflow-style:none] sm:mx-0 sm:flex-wrap sm:justify-center sm:gap-5 sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden">
        {categories.map((category, index) => {
          const palette =
            (category.department && paletteById.get(category.department.id)) ?? FALLBACK_PALETTE;
          const Icon = categoryIcon(category.name);
          return (
            <li
              key={category.id}
              className="cat-pop w-[4.5rem] shrink-0 snap-start sm:w-20"
              style={{ "--i": index } as CSSProperties}
            >
              <Link
                to={`/category/${category.slug}`}
                className="group flex flex-col items-center gap-1.5 text-center"
              >
                <span
                  className="grid h-16 w-16 place-items-center overflow-hidden rounded-full ring-2 ring-white transition duration-300 group-hover:-translate-y-0.5 group-hover:shadow-md sm:h-[4.5rem] sm:w-[4.5rem]"
                  style={{
                    backgroundColor: palette.softHex,
                    boxShadow: `0 0 0 1px ${palette.accentHex}26`,
                  }}
                >
                  {category.imageUrl ? (
                    <img
                      src={category.imageUrl}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                  ) : (
                    <Icon
                      aria-hidden
                      className="icon-wiggle h-7 w-7 transition-transform duration-300 group-hover:scale-110"
                      style={{ color: palette.deepHex }}
                      strokeWidth={1.6}
                    />
                  )}
                </span>
                <span className="line-clamp-2 text-[11px] leading-tight font-medium text-ink-700 group-hover:text-brand-500 sm:text-xs">
                  {category.name}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
