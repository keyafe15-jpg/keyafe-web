import { useSearchParams } from "react-router-dom";
import { useStaffPermission } from "@/lib/permissions";
import { cn } from "@/lib/cn";
import { StallCounterPage } from "./StallCounterPage";
import { StallHistory } from "./StallHistory";
import { StallBreakfastPanel } from "./StallBreakfastPanel";
import { Segmented } from "./stall-ui";

type Tab = "counter" | "history" | "breakfast";

const TABS: { key: Tab; label: string; managerOnly?: boolean }[] = [
  { key: "counter", label: "Counter" },
  { key: "history", label: "History", managerOnly: true },
  { key: "breakfast", label: "Breakfast" },
];

/** Counter and Breakfast for the stall team; History and breakfast billing for managers. */
export function StallSalesPage() {
  const canManage = useStaffPermission("stall.manage");
  const [params, setParams] = useSearchParams();
  const options = TABS.filter((t) => canManage || !t.managerOnly);
  const requested = params.get("tab");
  const tab: Tab = options.find((t) => t.key === requested)?.key ?? "counter";

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-slate-900">Stall sales</h1>
        <Segmented
          value={tab}
          onChange={(next) => setParams(next === "counter" ? {} : { tab: next })}
          options={options}
          className={cn("w-full", canManage ? "sm:w-80" : "sm:w-56")}
        />
      </div>
      {tab === "counter" ? (
        <StallCounterPage />
      ) : tab === "history" ? (
        <StallHistory />
      ) : (
        <StallBreakfastPanel />
      )}
    </div>
  );
}
