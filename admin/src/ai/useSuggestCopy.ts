import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";

export const SUGGEST_KINDS = [
  "productCopy",
  "itemCopy",
  "categoryCopy",
  "addonCopy",
  "flavourCopy",
  "couponCopy",
] as const;

export type SuggestKind = (typeof SUGGEST_KINDS)[number];

export const PHOTO_KINDS = new Set<SuggestKind>([
  "productCopy",
  "itemCopy",
  "categoryCopy",
  "addonCopy",
]);

export type SuggestContext = {
  name?: string;
  shortDescription?: string;
  description?: string;
  flavour?: string;
  size?: string;
  group?: string;
  extra?: string;
};

export type SuggestBundle = {
  names: string[];
  shortDescription?: string;
  description?: string;
  metaTitle?: string[];
  metaDescription?: string;
};

export type SuggestCopyPayload = SuggestContext & {
  kind: SuggestKind;
  image?: File | string | null;
};

function appendIf(form: FormData, key: string, value?: string) {
  const trimmed = value?.trim();
  if (trimmed) form.append(key, trimmed);
}

function toFormData(payload: SuggestCopyPayload): FormData {
  const form = new FormData();
  form.append("kind", payload.kind);
  appendIf(form, "name", payload.name);
  appendIf(form, "shortDescription", payload.shortDescription);
  appendIf(form, "description", payload.description);
  appendIf(form, "flavour", payload.flavour);
  appendIf(form, "size", payload.size);
  appendIf(form, "group", payload.group);
  appendIf(form, "extra", payload.extra?.slice(0, 4000));
  if (payload.image instanceof File) {
    form.append("image", payload.image);
  } else if (typeof payload.image === "string" && payload.image.trim()) {
    form.append("imageUrl", payload.image.trim());
  }
  return form;
}

export function useSuggestCopy() {
  return useMutation({
    mutationFn: (body: SuggestCopyPayload) =>
      api.postForm<SuggestBundle>("/admin/suggest-copy", toFormData(body)),
  });
}
