import { cn } from "@/lib/cn";
import {
  VENDOR_CHANNELS,
  channelLabel,
  type VendorChannel,
} from "@/pages/vendors/vendor-ui";

export function VendorChannelField({
  value,
  onChange,
  disabled,
}: {
  value: VendorChannel;
  onChange: (next: VendorChannel) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium tracking-wide text-slate-500 uppercase">
        Type
      </p>
      <div className="flex flex-wrap gap-1.5">
        {VENDOR_CHANNELS.map((c) => (
          <button
            key={c}
            type="button"
            disabled={disabled}
            aria-pressed={value === c}
            onClick={() => onChange(c)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition disabled:opacity-50",
              value === c
                ? "border-brand-500 bg-brand-500 text-white"
                : "border-slate-200 bg-white text-slate-700 hover:border-brand-300",
            )}
          >
            {channelLabel(c)}
          </button>
        ))}
      </div>
    </div>
  );
}
