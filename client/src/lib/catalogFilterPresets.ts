export type CatalogFilterPreset = {
  flavor: boolean;
  price: boolean;
  sort: boolean;
  shape: boolean;
  noCream: boolean;
  fixedDesign: boolean;
  diet: boolean;
  heat: boolean;
};

const DESSERT_PRESET: CatalogFilterPreset = {
  flavor: true,
  price: true,
  sort: true,
  shape: true,
  noCream: true,
  fixedDesign: true,
  diet: false,
  heat: false,
};

const SAVORY_PRESET: CatalogFilterPreset = {
  flavor: false,
  price: true,
  sort: true,
  shape: false,
  noCream: false,
  fixedDesign: false,
  diet: true,
  heat: true,
};

const DEFAULT_PRESET: CatalogFilterPreset = {
  flavor: true,
  price: true,
  sort: true,
  shape: false,
  noCream: false,
  fixedDesign: false,
  diet: false,
  heat: false,
};

/** Hardcoded filter sets by store department slug. */
export function presetForDepartment(slug?: string | null): CatalogFilterPreset {
  if (slug === "dessert") return DESSERT_PRESET;
  if (slug === "savory") return SAVORY_PRESET;
  return DEFAULT_PRESET;
}
