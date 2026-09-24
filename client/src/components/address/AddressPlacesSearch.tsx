import {
  AddressPlacesSearch as SharedAddressPlacesSearch,
  type AddressPlacesSearchProps,
  type ParsedPlace,
} from "@keyafe/shared";

const storefrontFallbackInputClass =
  "w-full rounded-lg border border-cream-200 bg-white py-2 pl-9 pr-3 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20";

/** Storefront-styled Places search (shared logic). */
export function AddressPlacesSearch(props: AddressPlacesSearchProps) {
  return (
    <SharedAddressPlacesSearch
      {...props}
      fallbackInputClassName={props.fallbackInputClassName ?? storefrontFallbackInputClass}
      hintClassName={props.hintClassName ?? "mt-1 text-[11px] text-ink-500"}
      errorHintClassName={props.errorHintClassName ?? "mt-1 text-[11px] text-brand-700"}
    />
  );
}

export type { ParsedPlace, AddressPlacesSearchProps };
