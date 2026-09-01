import { useEffect, useState } from "react";
import { PRODUCT_COPY } from "@/content/product";
import { DateSlotPicker, todayIso } from "./DateSlotPicker";
import { useSameDayStatus } from "@/hooks/useSameDayStatus";
import {
  computeSameDayEstimate,
  sameDaySlotLabel,
} from "@/lib/deliveryEstimate";
import type { PincodeCheckResult } from "@/hooks/usePincodeCheck";
import { cn } from "@/lib/cn";

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
    fulfillment === "delivery" && pincodeResult?.serviceable
      ? pincodeResult.extraLeadHours
      : 0;
  const zoneAllowsSameDay =
    fulfillment === "pickup" ||
    !pincodeResult?.serviceable ||
    pincodeResult.sameDayEligible;
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
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <ModeButton
          active={mode === "SAME_DAY"}
          disabled={!sameDayAvailable}
          onClick={() => setMode("SAME_DAY")}
          label="Same-day"
        />
        <ModeButton
          active={mode === "SCHEDULED"}
          onClick={() => setMode("SCHEDULED")}
          label="Choose date & time"
        />
      </div>

      {mode === "SAME_DAY" ? (
        !sameDayAvailable ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            {sameDayStatus?.message ??
              "Same-day ordering isn't available right now."}
          </p>
        ) : (
          <div className="rounded-lg border border-brand-200 bg-brand-100/40 px-3 py-2.5 text-sm">
            <p className="font-medium text-ink-900">Delivering today</p>
            <p className="mt-0.5 text-ink-600">
              Ready in ~{estimate.durationLabel} · arriving around{" "}
              {estimate.timeLabel}
            </p>
          </div>
        )
      ) : (
        <DateSlotPicker
          date={value.date}
          onDateChange={(date) => onChange({ ...value, date })}
          slot={value.slotKey === SAME_DAY_SLOT_KEY ? "" : value.slotKey}
          onSlotChange={handleScheduledSlotChange}
        />
      )}
    </div>
  );
}

function ModeButton({
  active,
  disabled,
  onClick,
  label,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded-lg border px-3 py-2 text-sm font-medium transition",
        active
          ? "border-brand-500 bg-brand-100 text-brand-700"
          : "border-cream-200 bg-white text-ink-700 hover:border-brand-300",
        disabled && "cursor-not-allowed opacity-40",
      )}
    >
      {label}
    </button>
  );
}
