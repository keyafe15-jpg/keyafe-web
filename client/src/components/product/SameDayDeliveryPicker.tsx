import { useEffect, useState } from "react";
import { PRODUCT_COPY } from "@/content/product";
import { DateSlotPicker, todayIso } from "./DateSlotPicker";
import { SegmentedChoice } from "./SegmentedChoice";
import { useSameDayStatus } from "@/hooks/useSameDayStatus";
import { computeSameDayEstimate, sameDaySlotLabel } from "@/lib/deliveryEstimate";
import type { PincodeCheckResult } from "@/hooks/usePincodeCheck";

export interface DeliveryTimingValue {
  date: string;
  slotKey: string;
  slotLabel: string;
  surcharge: number;
}

// Reserved slot key for the same-day track — never a real PRODUCT_COPY.timeSlots key.
export const SAME_DAY_SLOT_KEY = "SAME_DAY";

export function SameDayDeliveryPicker({
  supportsSameDayDelivery,
  leadTimeHours,
  fulfillment,
  pincodeResult,
  value,
  onChange,
}: {
  supportsSameDayDelivery: boolean;
  leadTimeHours: number;
  fulfillment: "delivery" | "pickup";
  pincodeResult: PincodeCheckResult | null;
  value: DeliveryTimingValue;
  onChange: (v: DeliveryTimingValue) => void;
}) {
  const [mode, setMode] = useState<"SAME_DAY" | "SCHEDULED">(
    supportsSameDayDelivery ? "SAME_DAY" : "SCHEDULED",
  );
  const { data: sameDayStatus, isLoading: statusLoading } = useSameDayStatus();

  const extraLeadHours =
    fulfillment === "delivery" && pincodeResult?.serviceable ? pincodeResult.extraLeadHours : 0;
  const zoneAllowsSameDay =
    fulfillment === "pickup" || !pincodeResult?.serviceable || pincodeResult.sameDayEligible;
  // Assume available while the store-hours check is still loading, to avoid
  // a same-day -> scheduled flicker on first paint.
  const sameDayAvailable =
    supportsSameDayDelivery &&
    zoneAllowsSameDay &&
    (statusLoading || sameDayStatus?.isOpen !== false);

  // Fall back to scheduled if same-day stops being available mid-flow.
  useEffect(() => {
    if (mode === "SAME_DAY" && !sameDayAvailable) setMode("SCHEDULED");
  }, [mode, sameDayAvailable]);

  // Without same-day, today can't be delivered: drop it (e.g. left over from
  // the same-day track) so the customer picks tomorrow or later.
  useEffect(() => {
    if (mode === "SCHEDULED" && !sameDayAvailable && value.date === todayIso()) {
      onChange({ ...value, date: "" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, sameDayAvailable, value.date]);

  const estimate = computeSameDayEstimate(leadTimeHours, extraLeadHours);

  // Keep the parent's committed value in sync while in same-day mode.
  useEffect(() => {
    if (mode !== "SAME_DAY") return;
    onChange({
      date: todayIso(),
      slotKey: SAME_DAY_SLOT_KEY,
      slotLabel: sameDaySlotLabel(estimate),
      surcharge: 0,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, estimate.timeLabel]);

  const handleScheduledSlotChange = (slotKey: string) => {
    const slot = PRODUCT_COPY.timeSlots.find((s) => s.key === slotKey);
    onChange({
      date: value.date,
      slotKey,
      slotLabel: slot?.label ?? slotKey,
      surcharge: slot?.surcharge ?? 0,
    });
  };

  if (!supportsSameDayDelivery) {
    return (
      <DateSlotPicker
        date={value.date}
        onDateChange={(date) => onChange({ ...value, date })}
        slot={value.slotKey}
        onSlotChange={handleScheduledSlotChange}
        allowToday={false}
      />
    );
  }

  return (
    <div className="space-y-3">
      <SegmentedChoice
        ariaLabel="Delivery timing"
        value={mode}
        onChange={setMode}
        options={[
          { value: "SAME_DAY", label: "Same-day", disabled: !sameDayAvailable },
          { value: "SCHEDULED", label: "Choose date & time" },
        ]}
      />

      {mode === "SAME_DAY" ? (
        !sameDayAvailable ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            {sameDayStatus?.message ?? "Same-day ordering isn't available right now."}
          </p>
        ) : (
          <div className="border-brand-200 rounded-lg border bg-brand-100/40 px-3 py-2.5 text-sm">
            <p className="font-medium text-ink-900">Delivering today</p>
            <p className="text-ink-600 mt-0.5">
              Ready in ~{estimate.durationLabel} · you may receive it around {estimate.timeLabel}
            </p>
          </div>
        )
      ) : (
        <DateSlotPicker
          date={value.date}
          onDateChange={(date) => onChange({ ...value, date })}
          slot={value.slotKey === SAME_DAY_SLOT_KEY ? "" : value.slotKey}
          onSlotChange={handleScheduledSlotChange}
          allowToday={sameDayAvailable}
        />
      )}
    </div>
  );
}
