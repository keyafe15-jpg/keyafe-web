export function listedItemImages(item: {
  referenceImageUrls?: string[] | null;
  referenceImageUrl?: string | null;
  productImage?: string | null;
}): string[] {
  if (item.referenceImageUrls?.length) return item.referenceImageUrls;
  if (item.referenceImageUrl) return [item.referenceImageUrl];
  if (item.productImage) return [item.productImage];
  return [];
}

export function RefImageStrip({
  urls,
  alt = "",
}: {
  urls: string[];
  alt?: string;
}) {
  if (urls.length === 0) {
    return <div className="h-12 w-12 shrink-0 rounded-md bg-cream-100" />;
  }
  return (
    <div className="flex max-w-[8.5rem] shrink-0 flex-wrap gap-1">
      {urls.map((src) => (
        <a
          key={src}
          href={src}
          target="_blank"
          rel="noreferrer"
          className="h-12 w-12 overflow-hidden rounded-md bg-cream-100"
          aria-label={alt ? `View ${alt}` : "View reference image"}
        >
          <img src={src} alt="" className="h-full w-full object-cover" />
        </a>
      ))}
    </div>
  );
}
