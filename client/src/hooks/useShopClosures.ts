import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface ShopClosure {
  id: string;
  startsOn: string;
  endsOn: string;
  reason: string | null;
}

export function useShopClosures() {
  return useQuery<ShopClosure[]>({
    queryKey: ["store", "closures"],
    queryFn: () => api.get<ShopClosure[]>("/store/closures"),
    staleTime: 60_000,
  });
}

export function isoDaysInRange(start: string, end: string): string[] {
  const days: string[] = [];
  const cur = new Date(`${start.slice(0, 10)}T00:00:00.000Z`);
  const last = new Date(`${end.slice(0, 10)}T00:00:00.000Z`);
  while (cur <= last) {
    days.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return days;
}

export function closedDateSet(closures: ShopClosure[]): Set<string> {
  const set = new Set<string>();
  for (const c of closures) {
    for (const day of isoDaysInRange(c.startsOn, c.endsOn)) set.add(day);
  }
  return set;
}

export function closureForDate(
  closures: ShopClosure[],
  iso: string,
): ShopClosure | undefined {
  const day = iso.slice(0, 10);
  return closures.find((c) => day >= c.startsOn && day <= c.endsOn);
}

export function closedDayMessage(hit: ShopClosure): string {
  return hit.reason?.trim()
    ? `We're closed that day — ${hit.reason.trim()}`
    : "We're closed on that date. Please pick another day.";
}
