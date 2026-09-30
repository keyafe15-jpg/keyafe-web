import { useSearchParams } from "react-router-dom";
import { useStaffPermission } from "@/lib/permissions";
import { StallCounterPage } from "./StallCounterPage";
import { StallHistory } from "./StallHistory";
import { Segmented } from "./stall-ui";

type Tab = "counter" | "history";

/** Counter for entering a day's sales; History (managers only) for past days and summaries. */
export function StallSalesPage() {
  const canManage = useStaffPermission("stall.manage");
  const [params, setParams] = useSearchParams();
  const tab: Tab = canManage && params.get("tab") === "history" ? "history" : "counter";

  return (
    <div className="mx-auto max-w-3xl">
      {canManage && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold text-slate-900">Stall sales</h1>
          <Segmented
            value={tab}
            onChange={(next) => setParams(next === "history" ? { tab: "history" } : {})}
            options={[
              { key: "counter", label: "Counter" },
              { key: "history", label: "History" },
            ]}
            className="w-full sm:w-64"
          />
        </div>
      )}
      {tab === "counter" ? <StallCounterPage /> : <StallHistory />}
    </div>
  );
}
