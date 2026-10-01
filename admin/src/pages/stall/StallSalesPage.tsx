import { useSearchParams } from "react-router-dom";
import { useStaffPermission } from "@/lib/permissions";
import { StallCounterPage } from "./StallCounterPage";
import { StallHistory } from "./StallHistory";
import { StallBreakfastPanel } from "./StallBreakfastPanel";
import { Segmented } from "./stall-ui";

type Tab = "counter" | "history" | "breakfast";

const MANAGER_TABS: Tab[] = ["history", "breakfast"];

/** Counter for entering a day's sales; History and Breakfast billing for managers. */
export function StallSalesPage() {
  const canManage = useStaffPermission("stall.manage");
  const [params, setParams] = useSearchParams();
  const requested = params.get("tab") as Tab | null;
  const tab: Tab =
    canManage && requested && MANAGER_TABS.includes(requested) ? requested : "counter";

  return (
    <div className="mx-auto max-w-3xl">
      {canManage && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold text-slate-900">Stall sales</h1>
          <Segmented
            value={tab}
            onChange={(next) => setParams(next === "counter" ? {} : { tab: next })}
            options={[
              { key: "counter", label: "Counter" },
              { key: "history", label: "History" },
              { key: "breakfast", label: "Breakfast" },
            ]}
            className="w-full sm:w-80"
          />
        </div>
      )}
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
