import { useEffect, useRef, useState, type ReactNode } from "react";
import { Field } from "@/components/form/Field";
import { AddressPlacesSearch, type ParsedPlace } from "@/components/address/AddressPlacesSearch";
import { cn } from "@/lib/cn";

export const compactAddressInputClass =
  "h-9 w-full rounded-md border border-slate-200 bg-white px-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20";

const compactInput = compactAddressInputClass;

function MiniLabel({
  children,
  required,
  error,
}: {
  children: ReactNode;
  required?: boolean;
  error?: string;
}) {
  return (
    <span className={cn("mb-0.5 block text-[11px] font-medium text-slate-500", error && "text-brand-600")}>
      {children}
      {required && (
        <span aria-hidden="true" className="ml-0.5 text-brand-500">
          *
        </span>
      )}
    </span>
  );
}

function addressSummary(line1: string, line2: string, landmark: string, pincode: string): string {
  const bits = [line2.trim(), landmark.trim(), pincode.trim()].filter(Boolean);
  const head = line1.trim() || "Address";
  return bits.length ? `${head} · ${bits.join(" · ")}` : head;
}

export function CompactAddressFields({
  searchLabel = "Search address",
  searchPlaceholder = "Building, society, or area",
  searchValue,
  onSearchChange,
  onPlaceSelect,
  line1,
  line2,
  landmark,
  pincode,
  onLine1,
  onLine2,
  onLandmark,
  onPincode,
  line1Error,
  pincodeError,
  forceOpen,
  besidePincode,
}: {
  searchLabel?: string;
  searchPlaceholder?: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onPlaceSelect: (place: ParsedPlace) => void;
  line1: string;
  line2: string;
  landmark: string;
  pincode: string;
  onLine1: (value: string) => void;
  onLine2: (value: string) => void;
  onLandmark: (value: string) => void;
  onPincode: (value: string) => void;
  line1Error?: string;
  pincodeError?: string;
  forceOpen?: boolean;
  /** Sits on the PIN row — delivery ₹ on the place-order form. */
  besidePincode?: ReactNode;
}) {
  const hasAddress = line1.trim().length > 0 || pincode.trim().length > 0;
  const [manualOpen, setManualOpen] = useState(() => hasAddress);
  const [landmarkOpen, setLandmarkOpen] = useState(() => landmark.trim().length > 0);
  const [flatOpen, setFlatOpen] = useState(() => line2.trim().length > 0);
  const lockedOpen = Boolean(forceOpen || line1Error || pincodeError);
  const hadAddress = useRef(hasAddress);

  useEffect(() => {
    if (lockedOpen) setManualOpen(true);
  }, [lockedOpen]);

  useEffect(() => {
    if (hasAddress && !hadAddress.current) setManualOpen(true);
    hadAddress.current = hasAddress;
  }, [hasAddress]);

  useEffect(() => {
    if (landmark.trim()) setLandmarkOpen(true);
  }, [landmark]);

  useEffect(() => {
    if (line2.trim()) setFlatOpen(true);
  }, [line2]);

  return (
    <>
      <Field label={searchLabel} required className="col-span-2">
        <AddressPlacesSearch
          value={searchValue}
          onChange={onSearchChange}
          onPlaceSelect={(place) => {
            setManualOpen(true);
            onPlaceSelect(place);
          }}
          placeholder={searchPlaceholder}
        />
      </Field>
      {manualOpen ? (
        <div className="col-span-2 space-y-2">
          <label className="block">
            <MiniLabel required error={line1Error}>
              Line 1
            </MiniLabel>
            <input
              value={line1}
              onChange={(e) => onLine1(e.target.value)}
              placeholder="12A, Prince Anwar Shah Road"
              className={cn(compactInput, line1Error && "border-brand-400")}
            />
            {line1Error && <p className="mt-0.5 text-[11px] text-brand-600">{line1Error}</p>}
          </label>
          {flatOpen && (
            <label className="block">
              <MiniLabel>Flat / floor</MiniLabel>
              <input
                value={line2}
                onChange={(e) => onLine2(e.target.value)}
                placeholder="3B"
                className={compactInput}
              />
            </label>
          )}
          <div
            className={cn(
              "grid gap-2",
              besidePincode ? "grid-cols-[6.5rem_minmax(0,1fr)]" : "grid-cols-1 sm:max-w-[6.5rem]",
            )}
          >
            <label>
              <MiniLabel required error={pincodeError}>
                PIN
              </MiniLabel>
              <input
                inputMode="numeric"
                maxLength={6}
                value={pincode}
                onChange={(e) => onPincode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="700001"
                className={cn(compactInput, "tabular-nums", pincodeError && "border-brand-400")}
              />
            </label>
            {besidePincode}
          </div>
          {pincodeError && <p className="-mt-1 text-[11px] text-brand-600">{pincodeError}</p>}
          {landmarkOpen && (
            <label className="block">
              <MiniLabel>Landmark</MiniLabel>
              <input
                value={landmark}
                onChange={(e) => onLandmark(e.target.value)}
                placeholder="Near South City"
                className={compactInput}
              />
            </label>
          )}
          {(!flatOpen || !landmarkOpen || (hasAddress && !lockedOpen)) && (
            <div className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 flex-wrap gap-x-3">
                {!flatOpen && (
                  <button
                    type="button"
                    onClick={() => setFlatOpen(true)}
                    className="text-[11px] font-medium text-brand-700 hover:underline"
                  >
                    Add flat
                  </button>
                )}
                {!landmarkOpen && (
                  <button
                    type="button"
                    onClick={() => setLandmarkOpen(true)}
                    className="text-[11px] font-medium text-brand-700 hover:underline"
                  >
                    Add landmark
                  </button>
                )}
              </span>
              {hasAddress && !lockedOpen && (
                <button
                  type="button"
                  onClick={() => setManualOpen(false)}
                  className="text-[11px] font-medium text-slate-500 hover:text-slate-700"
                >
                  Done
                </button>
              )}
            </div>
          )}
        </div>
      ) : hasAddress ? (
        <button
          type="button"
          onClick={() => setManualOpen(true)}
          className="col-span-2 flex items-start justify-between gap-3 rounded-md border border-slate-200 bg-slate-50/80 px-2.5 py-2 text-left"
        >
          <span className="min-w-0 text-sm leading-snug text-slate-800">
            {addressSummary(line1, line2, landmark, pincode)}
          </span>
          <span className="shrink-0 text-[11px] font-medium text-brand-700">Edit</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setManualOpen(true)}
          className="col-span-2 -mt-1 text-left text-xs font-medium text-brand-700 hover:underline"
        >
          Enter address manually
        </button>
      )}
    </>
  );
}
