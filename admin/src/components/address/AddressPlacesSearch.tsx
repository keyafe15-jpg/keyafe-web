import {
  AddressPlacesSearch as SharedAddressPlacesSearch,
  type AddressPlacesSearchProps,
  type ParsedPlace,
} from "@keyafe/shared";
import { inputClass } from "@/components/form/Field";

const adminFallbackInputClass = `${inputClass} pl-9`;

/** Admin-styled Places search (shared logic). */
export function AddressPlacesSearch(props: AddressPlacesSearchProps) {
  return (
    <SharedAddressPlacesSearch
      {...props}
      fallbackInputClassName={props.fallbackInputClassName ?? adminFallbackInputClass}
      hintClassName={props.hintClassName ?? "mt-1 text-[11px] text-slate-500"}
      errorHintClassName={props.errorHintClassName ?? "mt-1 text-[11px] text-brand-700"}
    />
  );
}

export type { ParsedPlace, AddressPlacesSearchProps };
