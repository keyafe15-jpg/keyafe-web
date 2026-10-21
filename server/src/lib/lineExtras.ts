/**
 * Keep in sync with packages/shared/src/lineExtras.ts — server tsc cannot
 * import the workspace package source under NodeNext.
 */
export interface LineExtra {
  group: string;
  names: string;
}

export interface ParsedLineNotes {
  extras: LineExtra[];
  notes: string | null;
}

export interface LineDisplayNotes {
  extras: LineExtra[];
  notes: string | null;
  message: string | null;
}

const SEGMENT_RE = /^([^:]{1,40}):\s+(.+)$/;
const KNOWN_EXTRA_GROUPS = new Set([
  "crust",
  "toppings",
  "condiments",
  "add-ons",
  "addons",
  "candles",
  "toppers",
]);

function isExtraSegment(raw: string): LineExtra | null {
  const match = SEGMENT_RE.exec(raw.trim());
  if (!match) return null;
  const group = match[1]!.trim();
  const names = match[2]!.trim();
  if (!group || !names) return null;
  return { group, names };
}

function isKnownExtraGroup(group: string): boolean {
  return KNOWN_EXTRA_GROUPS.has(group.trim().toLowerCase());
}

export function parseLineNotes(raw: string | null | undefined): ParsedLineNotes {
  const text = raw?.trim() ?? "";
  if (!text) return { extras: [], notes: null };

  const extras: LineExtra[] = [];
  const leftover: string[] = [];

  for (const line of text.split(/\n+/)) {
    const segments = line
      .split(" · ")
      .map((s) => s.trim())
      .filter(Boolean);
    const unmatched: string[] = [];
    for (const segment of segments) {
      const extra = isExtraSegment(segment);
      if (extra) extras.push(extra);
      else unmatched.push(segment);
    }
    if (unmatched.length) leftover.push(unmatched.join(" · "));
  }

  const notes = leftover.join("\n").trim();
  return { extras, notes: notes || null };
}

export function splitCakeMessage(raw: string | null | undefined): {
  extras: LineExtra[];
  message: string | null;
} {
  const text = raw?.trim() ?? "";
  if (!text) return { extras: [], message: null };

  const parsed = parseLineNotes(text);
  if (parsed.extras.length === 0) return { extras: [], message: text };

  const looksComposed =
    parsed.extras.length > 1 || parsed.extras.some((e) => isKnownExtraGroup(e.group));
  if (!looksComposed) return { extras: [], message: text };

  return { extras: parsed.extras, message: parsed.notes };
}

export function extrasPlainText(extras: LineExtra[]): string {
  return extras.map((e) => `${e.group}: ${e.names}`).join(" · ");
}

export function lineDisplayNotes(input: {
  instructions?: string | null;
  messageOnCake?: string | null;
}): LineDisplayNotes {
  const fromInst = parseLineNotes(input.instructions);
  const fromMsg = splitCakeMessage(input.messageOnCake);
  const extras = [...fromInst.extras];
  for (const extra of fromMsg.extras) {
    if (!extras.some((e) => e.group === extra.group && e.names === extra.names)) {
      extras.push(extra);
    }
  }
  return {
    extras,
    notes: fromInst.notes,
    message: fromMsg.message,
  };
}
