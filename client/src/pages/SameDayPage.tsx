import { useMemo, useState } from "react";
import { Link, NavLink, useSearchParams } from "react-router-dom";
import { cn } from "@/lib/cn";
import { useSameDayStatus } from "@/hooks/useSameDayStatus";
import { useSameDayProducts, type ProductCard } from "@/hooks/useProducts";
import { useCategories, type CategoryNode } from "@/hooks/useCategories";
import { LeadTimeChip } from "@/components/product/LeadTimeChip";
import { SAMEDAY_COPY } from "@/content/sameday";

export function SameDayPage() {
  const { data: status, isLoading: statusLoading } = useSameDayStatus();
  const { data: products = [], isLoading: productsLoading } =
    useSameDayProducts();
  const { data: categories = [], isLoading: catsLoading } = useCategories();

  const isOpen = status?.isOpen ?? false;
  const statusMessage = status?.message ?? "";

  // Set of category IDs any same-day product belongs to.
  const eligibleIds = useMemo(
    () => new Set(products.map((p) => p.category.id)),
    [products],
  );

  // Prune tree — keep a node if it (or any descendant) has same-day products.
  const pruned = useMemo(
    () => pruneTree(categories, eligibleIds),
    [categories, eligibleIds],
  );

  const [params, setParams] = useSearchParams();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const activeSlug = params.get("cat") ?? pruned[0]?.slug ?? "";
  const activeNode = useMemo(
    () => findBySlug(pruned, activeSlug),
    [pruned, activeSlug],
  );

  const setCategory = (slug: string) => {
    setParams({ cat: slug });
    setMobileNavOpen(false);
  };

  const toggleExpanded = (slug: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(slug) ? next.delete(slug) : next.add(slug);
      return next;
    });
  };

  // Auto-expand the branch that contains the current selection so the user
  // never has to open it to see where they are.
  const autoExpanded = useMemo(() => {
    const next = new Set(expanded);
    for (const top of pruned) {
      if (
        top.slug === activeSlug ||
        top.children.some((c) => c.slug === activeSlug)
      ) {
        next.add(top.slug);
      }
    }
    return next;
  }, [expanded, pruned, activeSlug]);

  // A top-level pick includes its subcategories' products; a subcategory pick
  // narrows to that subcategory.
  const activeIds = useMemo(
    () => (activeNode ? collectIds(activeNode) : new Set<string>()),
    [activeNode],
  );

  const visibleProducts = useMemo(
    () => products.filter((p) => activeIds.has(p.category.id)),
    [products, activeIds],
  );

  const activeLabel = activeNode?.name ?? "…";

  return (
    <section className="mx-auto max-w-6xl px-4 pt-8 pb-16">
      {/* Header + hours banner */}
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="mb-2 flex items-center gap-2 text-sm uppercase tracking-widest text-brand-500">
            <BoltIcon /> {SAMEDAY_COPY.eyebrow}
          </p>
          <h1 className="font-display text-3xl text-ink-900 md:text-4xl">
            {SAMEDAY_COPY.title}
          </h1>
          <p className="mt-2 max-w-xl text-sm text-ink-500">
            {SAMEDAY_COPY.sub}
          </p>
        </div>
        {!statusLoading && (
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-2 self-start rounded-full border px-3 py-1.5 text-xs font-medium",
              isOpen
                ? "border-brand-300 bg-brand-100 text-brand-700"
                : "border-cream-200 bg-cream-100 text-ink-500",
            )}
          >
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                isOpen ? "bg-brand-500" : "bg-ink-500",
              )}
            />
            {statusMessage}
          </span>
        )}
      </div>

      {!statusLoading && !isOpen && (
        <div className="mb-6 flex flex-col items-center gap-3 rounded-card border border-cream-200 bg-cream-50 p-8 text-center">
          <div className="rounded-full bg-cream-100 p-3 text-ink-500">
            <ClockIcon />
          </div>
          <h2 className="font-display text-xl text-ink-900">
            Same-day store is closed
          </h2>
          <p className="max-w-md text-sm text-ink-500">{statusMessage}</p>
          <p className="text-xs text-ink-500">
            You can still browse our full catalogue and pre-order celebration
            cakes for later.
          </p>
        </div>
      )}

      {/* Mobile category picker */}
      <div className="mb-4 md:hidden">
        <button
          type="button"
          onClick={() => setMobileNavOpen((v) => !v)}
          className="flex w-full items-center justify-between rounded-lg border border-cream-200 bg-white px-3 py-2 text-sm"
        >
          <span>
            <span className="text-ink-500">
              {SAMEDAY_COPY.sidebarMobileLabel}:
            </span>{" "}
            <span className="font-medium text-ink-900">{activeLabel}</span>
          </span>
          <ChevronIcon open={mobileNavOpen} />
        </button>
        {mobileNavOpen && (
          <ul className="mt-2 space-y-1 rounded-lg border border-cream-200 bg-white p-2">
            {pruned.map((top) => (
              <MobileNavItem
                key={top.id}
                node={top}
                products={products}
                activeSlug={activeSlug}
                onPick={setCategory}
                expanded={autoExpanded}
                onToggle={toggleExpanded}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Two-column layout */}
      <div className="grid gap-6 md:grid-cols-[220px_1fr]">
        <aside className="hidden md:block">
          <div className="sticky top-24">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-500">
              {SAMEDAY_COPY.sidebarHeading}
            </p>
            <nav className="space-y-1">
              {catsLoading &&
                Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-9 animate-pulse rounded-lg bg-cream-100"
                  />
                ))}
              {!catsLoading && (
                <>
                  {pruned.map((top) => (
                    <SidebarBranch
                      key={top.id}
                      node={top}
                      products={products}
                      activeSlug={activeSlug}
                      onPick={setCategory}
                      expanded={autoExpanded}
                      onToggle={toggleExpanded}
                    />
                  ))}
                </>
              )}
            </nav>

            <p className="mt-6 rounded-lg border border-cream-200 bg-cream-50 p-3 text-xs text-ink-500">
              {SAMEDAY_COPY.deliveryFeeNote}
            </p>
          </div>
        </aside>

        {/* Products grid */}
        <div className={cn(!isOpen && "opacity-60")}>
          <h2 className="mb-1 text-xl text-ink-900">{activeLabel}</h2>
          {activeNode?.description && (
            <p className="mb-4 text-sm text-ink-500">
              {activeNode.description}
            </p>
          )}

          {productsLoading && <ProductGridSkeleton />}

          {!productsLoading && visibleProducts.length === 0 && (
            <div className="rounded-card border border-cream-200 bg-cream-50 p-8 text-center text-sm text-ink-500">
              Nothing available for same-day in this category right now.
            </div>
          )}

          {!productsLoading && visibleProducts.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visibleProducts.map((p) => (
                <ProductCardView key={p.id} product={p} disabled={!isOpen} />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// -------- sidebar pieces --------

function SidebarBranch({
  node,
  products,
  activeSlug,
  onPick,
  expanded,
  onToggle,
}: {
  node: CategoryNode;
  products: ProductCard[];
  activeSlug: string;
  onPick: (slug: string) => void;
  expanded: Set<string>;
  onToggle: (slug: string) => void;
}) {
  const branchIds = collectIds(node);
  const count = products.filter((p) => branchIds.has(p.category.id)).length;
  const hasChildren = node.children.length > 0;
  const isOpen = expanded.has(node.slug);
  return (
    <>
      <ParentRow
        label={`${node.name} (${count})`}
        active={activeSlug === node.slug}
        hasChildren={hasChildren}
        isOpen={isOpen}
        onSelect={() => onPick(node.slug)}
        onToggle={() => onToggle(node.slug)}
      />
      {hasChildren && isOpen && (
        <div className="ml-4 mt-0.5 space-y-0.5 border-l-2 border-cream-200 pl-2">
          {node.children.map((child) => {
            const childIds = collectIds(child);
            const childCount = products.filter((p) =>
              childIds.has(p.category.id),
            ).length;
            return (
              <SidebarLink
                key={child.id}
                label={`↳ ${child.name} (${childCount})`}
                active={activeSlug === child.slug}
                onClick={() => onPick(child.slug)}
              />
            );
          })}
        </div>
      )}
    </>
  );
}

// A parent row with a chevron toggle. Clicking the label selects the branch;
// clicking the chevron just expands/collapses.
function ParentRow({
  label,
  active,
  hasChildren,
  isOpen,
  onSelect,
  onToggle,
}: {
  label: string;
  active: boolean;
  hasChildren: boolean;
  isOpen: boolean;
  onSelect: () => void;
  onToggle: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center rounded-lg text-sm transition",
        active
          ? "bg-brand-100 font-medium text-brand-700"
          : "text-ink-700 hover:bg-cream-100",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex-1 rounded-l-lg px-3 py-2 text-left"
      >
        {label}
      </button>
      {hasChildren && (
        <button
          type="button"
          onClick={onToggle}
          aria-label={isOpen ? "Collapse" : "Expand"}
          className="flex h-8 w-8 items-center justify-center rounded-r-lg text-ink-500 hover:text-ink-900"
        >
          <ChevronIcon open={isOpen} />
        </button>
      )}
    </div>
  );
}

function SidebarLink({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <NavLink
      to="#"
      onClick={(e) => {
        e.preventDefault();
        onClick();
      }}
      className={cn(
        "block rounded-lg px-3 py-2 text-sm transition",
        active
          ? "bg-brand-100 font-medium text-brand-700"
          : "text-ink-700 hover:bg-cream-100",
      )}
    >
      {label}
    </NavLink>
  );
}

function MobileNavItem({
  node,
  products,
  activeSlug,
  onPick,
  expanded,
  onToggle,
}: {
  node: CategoryNode;
  products: ProductCard[];
  activeSlug: string;
  onPick: (slug: string) => void;
  expanded: Set<string>;
  onToggle: (slug: string) => void;
}) {
  const branchIds = collectIds(node);
  const count = products.filter((p) => branchIds.has(p.category.id)).length;
  const hasChildren = node.children.length > 0;
  const isOpen = expanded.has(node.slug);
  return (
    <li>
      <div
        className={cn(
          "flex items-center rounded-md text-sm",
          node.slug === activeSlug
            ? "bg-brand-100 text-brand-700"
            : "text-ink-700 hover:bg-cream-100",
        )}
      >
        <button
          type="button"
          onClick={() => onPick(node.slug)}
          className="flex-1 px-3 py-2 text-left"
        >
          {node.name} ({count})
        </button>
        {hasChildren && (
          <button
            type="button"
            onClick={() => onToggle(node.slug)}
            aria-label={isOpen ? "Collapse" : "Expand"}
            className="flex h-8 w-8 items-center justify-center text-ink-500"
          >
            <ChevronIcon open={isOpen} />
          </button>
        )}
      </div>
      {hasChildren && isOpen && (
        <ul className="ml-4 space-y-1">
          {node.children.map((child) => {
            const childIds = collectIds(child);
            const childCount = products.filter((p) =>
              childIds.has(p.category.id),
            ).length;
            return (
              <li key={child.id}>
                <button
                  type="button"
                  onClick={() => onPick(child.slug)}
                  className={cn(
                    "block w-full rounded-md px-3 py-2 text-left text-sm transition",
                    child.slug === activeSlug
                      ? "bg-brand-100 text-brand-700"
                      : "text-ink-700 hover:bg-cream-100",
                  )}
                >
                  {child.name} ({childCount})
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}

// -------- tree helpers --------

// Keep only categories that (directly or via a descendant) contain a same-day product.
function pruneTree(
  tree: CategoryNode[],
  eligibleIds: Set<string>,
): CategoryNode[] {
  return tree
    .map((n) => ({ ...n, children: pruneTree(n.children, eligibleIds) }))
    .filter((n) => eligibleIds.has(n.id) || n.children.length > 0);
}

function findBySlug(
  tree: CategoryNode[],
  slug: string,
): CategoryNode | null {
  for (const n of tree) {
    if (n.slug === slug) return n;
    const inChildren = findBySlug(n.children, slug);
    if (inChildren) return inChildren;
  }
  return null;
}

function collectIds(node: CategoryNode): Set<string> {
  const s = new Set<string>();
  const walk = (n: CategoryNode) => {
    s.add(n.id);
    n.children.forEach(walk);
  };
  walk(node);
  return s;
}

// -------- card + skeleton --------

function ProductCardView({
  product,
  disabled,
}: {
  product: ProductCard;
  disabled: boolean;
}) {
  const priceValue = `₹${Number(product.startingPrice).toFixed(0)}`;
  const showsRange = product.template !== "CAKE";

  return (
    <article className="group rounded-card border border-cream-200 bg-white p-3 shadow-sm transition hover:shadow-md">
      <Link to={`/product/${product.slug}`} className="block">
        <div className="mb-3 aspect-square overflow-hidden rounded-lg bg-cream-100">
          {product.images[0] && (
            <img
              src={product.images[0]}
              alt={product.name}
              className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
            />
          )}
        </div>
        <h3 className="line-clamp-2 text-sm font-medium text-ink-900 group-hover:text-brand-500">
          {product.name}
        </h3>
        {product.shortDescription && (
          <p className="mt-1 line-clamp-2 text-xs text-ink-500">
            {product.shortDescription}
          </p>
        )}
        <div className="mt-2 flex items-center justify-between">
          <span className="text-sm font-semibold text-ink-900">
            {showsRange && (
              <span className="mr-1 text-[10px] font-normal text-ink-500">
                from
              </span>
            )}
            {priceValue}
          </span>
          <LeadTimeChip
            leadTimeHours={product.leadTimeHours}
            supportsSameDay={product.supportsSameDayDelivery}
          />
        </div>
      </Link>
      <button
        type="button"
        disabled={disabled}
        className="mt-3 w-full rounded-full bg-brand-500 py-1.5 text-xs font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {disabled ? "Closed" : "Add to cart"}
      </button>
    </article>
  );
}

function ProductGridSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-card border border-cream-200 bg-white p-3"
        >
          <div className="mb-3 aspect-square rounded-lg bg-cream-100" />
          <div className="h-4 w-3/4 rounded bg-cream-100" />
          <div className="mt-2 h-3 w-1/2 rounded bg-cream-100" />
          <div className="mt-3 h-8 w-full rounded-full bg-cream-100" />
        </div>
      ))}
    </div>
  );
}

// -------- icons --------

function BoltIcon() {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg
      width={28}
      height={28}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx={12} cy={12} r={10} />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("text-ink-500 transition-transform", open && "rotate-180")}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}
