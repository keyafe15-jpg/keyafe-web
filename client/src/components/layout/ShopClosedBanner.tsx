import { closureForDate, useShopClosures } from "@/hooks/useShopClosures";
import { todayIso } from "@/components/product/DateSlotPicker";

export function ShopClosedBanner() {
  const { data: closures = [] } = useShopClosures();
  const today = closureForDate(closures, todayIso());
  if (!today) return null;

  return (
    <div className="bg-ink-900 px-4 py-2 text-center text-xs text-cream-50 sm:text-sm">
      {today.reason?.trim()
        ? `Kitchen closed today — ${today.reason.trim()}. You can still order for a later date.`
        : "Kitchen is closed today. You can still order for a later date."}
    </div>
  );
}
