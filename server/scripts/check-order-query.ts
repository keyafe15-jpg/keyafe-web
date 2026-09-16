// Sanity checks for the admin order query validators. Pure schema work,
// no database. Run: pnpm --filter server exec tsx scripts/check-order-query.ts
import type { z } from "zod";
import {
  listQuerySchema,
  scheduleQuerySchema,
} from "../src/modules/orders/order.admin.routes.js";

let failures = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(
    `${ok ? "ok  " : "FAIL"}  ${label}` +
      (ok
        ? ""
        : `\n        got  ${JSON.stringify(actual)}\n        want ${JSON.stringify(expected)}`),
  );
}

/** Binds the accept/reject helpers to one schema so both can be checked. */
function checkerFor<T extends z.ZodTypeAny>(schema: T) {
  return {
    accepts(label: string, query: Record<string, string>): z.infer<T> | null {
      const parsed = schema.safeParse(query);
      if (!parsed.success) {
        failures++;
        console.log(
          `FAIL  ${label}\n        rejected: ${JSON.stringify(parsed.error.flatten().fieldErrors)}`,
        );
        return null;
      }
      console.log(`ok    ${label}`);
      return parsed.data;
    },
    rejects(label: string, query: Record<string, string>, field: string) {
      const parsed = schema.safeParse(query);
      const ok =
        !parsed.success &&
        Object.keys(parsed.error.flatten().fieldErrors).includes(field);
      if (!ok) failures++;
      console.log(
        `${ok ? "ok  " : "FAIL"}  ${label}` +
          (ok
            ? ""
            : `\n        expected a ${field} error, got ${parsed.success ? "success" : JSON.stringify(parsed.error.flatten().fieldErrors)}`),
      );
    },
  };
}

const list = checkerFor(listQuerySchema);
const sched = checkerFor(scheduleQuerySchema);

console.log("== order list query ==");

// --- defaults ---------------------------------------------------------
const empty = list.accepts("empty query parses", {});
check("  page defaults to 1", empty?.page, 1);
check("  pageSize defaults to 20", empty?.pageSize, 20);
check("  status is unset", empty?.status, undefined);

// --- pagination -------------------------------------------------------
const paged = list.accepts("numeric strings coerce", {
  page: "3",
  pageSize: "50",
});
check("  page coerced", paged?.page, 3);
check("  pageSize coerced", paged?.pageSize, 50);
check(
  "  board views' pageSize=100 is allowed",
  list.accepts("pageSize=100 parses", { pageSize: "100" })?.pageSize,
  100,
);
list.rejects("pageSize above the cap is refused", { pageSize: "101" }, "pageSize");
list.rejects("page zero is refused", { page: "0" }, "page");
list.rejects("non-numeric page is refused", { page: "abc" }, "page");
list.rejects("fractional page is refused", { page: "1.5" }, "page");

// --- statuses ---------------------------------------------------------
check(
  "known status passes through",
  list.accepts("status=CONFIRMED parses", { status: "CONFIRMED" })?.status,
  "CONFIRMED",
);
list.rejects("unknown status is refused", { status: "ALL" }, "status");

const excluded = list.accepts("excludeStatus splits on commas", {
  excludeStatus: "DELIVERED, CANCELLED",
});
check("  whitespace trimmed", excluded?.excludeStatus, [
  "DELIVERED",
  "CANCELLED",
]);
check(
  "  empty excludeStatus yields no entries",
  list.accepts("excludeStatus= parses", { excludeStatus: "" })?.excludeStatus,
  [],
);
list.rejects(
  "unknown excludeStatus member is refused",
  { excludeStatus: "DELIVERED,NOPE" },
  "excludeStatus",
);

// --- search -----------------------------------------------------------
check(
  "search is trimmed",
  list.accepts("search parses", { search: "  acme  " })?.search,
  "acme",
);
check(
  "blank search becomes unset",
  list.accepts("blank search parses", { search: "   " })?.search,
  undefined,
);

// --- dates ------------------------------------------------------------
const dated = list.accepts("delivery range parses", {
  deliveryFrom: "2026-09-01",
  deliveryTo: "2026-09-30",
});
check(
  "  deliveryFrom is local midnight",
  dated?.deliveryFrom instanceof Date && dated.deliveryFrom.getHours() === 0,
  true,
);
check(
  "  deliveryFrom keeps the requested day",
  dated?.deliveryFrom instanceof Date ? dated.deliveryFrom.getDate() : null,
  1,
);
list.rejects("malformed date is refused", { deliveryFrom: "01-09-2026" }, "deliveryFrom");
list.rejects("rolled-over date is refused", { deliveryFrom: "2026-02-31" }, "deliveryFrom");
list.rejects("month 13 is refused", { deliveryFrom: "2026-13-01" }, "deliveryFrom");

// --- panIndia ---------------------------------------------------------
check(
  "panIndia=1 is true",
  list.accepts("panIndia=1 parses", { panIndia: "1" })?.panIndia,
  true,
);
check(
  "panIndia=0 is false",
  list.accepts("panIndia=0 parses", { panIndia: "0" })?.panIndia,
  false,
);
list.rejects("panIndia=yes is refused", { panIndia: "yes" }, "panIndia");

console.log("\n== delivery schedule query ==");

// --- defaults ---------------------------------------------------------
const schedEmpty = sched.accepts("empty query parses", {});
check("  dir defaults to soonest-first", schedEmpty?.dir, "asc");
check("  page defaults to 1", schedEmpty?.page, 1);
check("  pageSize defaults to 25", schedEmpty?.pageSize, 25);
check(
  "  deliveryFrom is unset so the route can default it to today",
  schedEmpty?.deliveryFrom,
  undefined,
);

// --- direction --------------------------------------------------------
check(
  "dir=desc is accepted",
  sched.accepts("dir=desc parses", { dir: "desc" })?.dir,
  "desc",
);
sched.rejects("unknown dir is refused", { dir: "sideways" }, "dir");

// --- shared filter vocabulary -----------------------------------------
check(
  "excludeStatus behaves as on the list",
  sched.accepts("excludeStatus parses", {
    excludeStatus: "CANCELLED, DELIVERED",
  })?.excludeStatus,
  ["CANCELLED", "DELIVERED"],
);
sched.rejects(
  "unknown excludeStatus member is refused",
  { excludeStatus: "CANCELLED,NOPE" },
  "excludeStatus",
);
check(
  "blank search becomes unset",
  sched.accepts("blank search parses", { search: "  " })?.search,
  undefined,
);
sched.rejects("unknown status is refused", { status: "ALL" }, "status");
sched.rejects(
  "rolled-over date is refused",
  { deliveryFrom: "2026-02-31" },
  "deliveryFrom",
);

// --- pagination -------------------------------------------------------
sched.rejects("pageSize above the cap is refused", { pageSize: "101" }, "pageSize");
check(
  "pageSize=100 is allowed",
  sched.accepts("pageSize=100 parses", { pageSize: "100" })?.pageSize,
  100,
);

// The schedule has no panIndia switch: those items have no delivery date and
// so cannot appear in a date-ordered list at all.
check(
  "panIndia is not part of the schedule query",
  "panIndia" in (sched.accepts("panIndia is ignored", { panIndia: "1" }) ?? {}),
  false,
);

console.log(failures === 0 ? "\nall good" : `\n${failures} failure(s)`);
process.exit(failures === 0 ? 0 : 1);
