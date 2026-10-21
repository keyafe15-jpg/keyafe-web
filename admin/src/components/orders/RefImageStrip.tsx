import { ImageOff } from "lucide-react";
import { ImageLightboxThumb } from "@/components/ui/ImageLightboxThumb";

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
  size = "h-14 w-14",
}: {
  urls: string[];
  alt?: string;
  size?: string;
}) {
  if (urls.length === 0) {
    return (
      <div className={`flex ${size} shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-400`}>
        <ImageOff className="h-4 w-4" />
      </div>
    );
  }
  return (
    <div className="flex max-w-[11rem] shrink-0 flex-wrap gap-1">
      {urls.map((src) => (
        <ImageLightboxThumb key={src} src={src} alt={alt} className={size} />
      ))}
    </div>
  );
}
