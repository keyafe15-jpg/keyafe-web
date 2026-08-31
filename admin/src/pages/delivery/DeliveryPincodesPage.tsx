import { useState } from "react";
import {
  FileSpreadsheet,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  useAdminDeliveryPincodes,
  useBulkImportDeliveryPincodes,
  useCreateDeliveryPincode,
  useDeleteDeliveryPincode,
  useUpdateDeliveryPincode,
  type AdminDeliveryPincode,
  type DeliveryDistrict,
  type DeliveryPincodePayload,
} from "@/hooks/useAdminDeliveryPincodes";
import { cn } from "@/lib/cn";
import {
  Field,
  inputClass,
  selectClass,
  submitClass,
} from "@/components/form/Field";
import {
  ClientPagination,
  PaginationControls,
} from "@/components/ClientPagination";

const DISTRICTS: DeliveryDistrict[] = ["HOWRAH", "KOLKATA", "HOOGHLY"];
const PAGE_SIZE = 10;
const IMPORT_COLUMNS =
  "pincode, city, area/areaName, district, deliveryFee/customerDeliveryFee, minOrderAmount, sameDayEligible, expressEligible, extraLeadHours, notes";

const emptyForm: DeliveryPincodePayload = {
  pincode: "",
  city: "Howrah",
  area: "",
  district: "HOWRAH",
  deliveryFee: 49,
  sameDayEligible: true,
  minOrderAmount: 299,
  extraLeadHours: 0,
  notes: "",
  isActive: true,
  expressEligible: true,
  expressDeliveryFee: null,
};

const toNumberOrNull = (value: unknown) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const pincodeIsValid = (pincode: string) => /^[1-9][0-9]{5}$/.test(pincode);

export function DeliveryPincodesPage() {
  const { data: pincodes = [], isLoading } = useAdminDeliveryPincodes();
  const [district, setDistrict] = useState<"ALL" | DeliveryDistrict>("ALL");
  const [query, setQuery] = useState("");

  const filtered = pincodes.filter((row) => {
    const matchesDistrict = district === "ALL" || row.district === district;
    const search = query.trim().toLowerCase();
    const matchesSearch =
      search.length === 0 ||
      row.pincode.includes(search) ||
      row.city.toLowerCase().includes(search) ||
      (row.area ?? "").toLowerCase().includes(search);
    return matchesDistrict && matchesSearch;
  });

  const activeCount = pincodes.filter((row) => row.isActive).length;
  const expressCount = pincodes.filter((row) => row.expressEligible).length;
  const averageFee =
    pincodes.length === 0
      ? 0
      : Math.round(
          pincodes.reduce((sum, row) => sum + Number(row.deliveryFee), 0) /
            pincodes.length,
        );

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Delivery zones
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Configure local delivery pincodes, customer-facing fees, minimum
            order values, and same-day or express eligibility.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <Stat label="Active" value={activeCount} />
          <Stat label="Express" value={expressCount} />
          <Stat label="Avg fee" value={`₹${averageFee}`} />
        </div>
      </div>

      <BulkImportPanel />

      <NewPincodeForm />

      <div className="mt-5 rounded-card border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative md:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search pincode, city, area"
              className={cn(inputClass, "pl-9")}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <FilterButton
              active={district === "ALL"}
              onClick={() => setDistrict("ALL")}
            >
              All
            </FilterButton>
            {DISTRICTS.map((item) => (
              <FilterButton
                key={item}
                active={district === item}
                onClick={() => setDistrict(item)}
              >
                {item}
              </FilterButton>
            ))}
          </div>
        </div>
      </div>

      <ClientPagination
        items={filtered}
        pageSize={PAGE_SIZE}
        resetKey={`${district}:${query}`}
      >
        {({ items, page, pageCount, total, firstItem, lastItem, setPage }) => (
          <>
            <div className="mt-4 overflow-hidden rounded-card border border-slate-200 bg-white">
              {isLoading && (
                <div className="p-8 text-center text-sm text-slate-500">
                  Loading…
                </div>
              )}
              {!isLoading && filtered.length === 0 && (
                <div className="p-8 text-center text-sm text-slate-500">
                  No delivery pincodes found.
                </div>
              )}
              {!isLoading && filtered.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[980px] text-left text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-2 font-medium">Area</th>
                        <th className="w-28 px-4 py-2 text-right font-medium">
                          Fee
                        </th>
                        <th className="w-32 px-4 py-2 text-right font-medium">
                          Min order
                        </th>
                        <th className="w-32 px-4 py-2 text-center font-medium">
                          Same day
                        </th>
                        <th className="w-28 px-4 py-2 text-center font-medium">
                          Express
                        </th>
                        <th className="w-32 px-4 py-2 text-center font-medium">
                          Lead
                        </th>
                        <th className="w-28 px-4 py-2 text-center font-medium">
                          Active
                        </th>
                        <th className="w-24 px-4 py-2 text-right font-medium">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {items.map((row) => (
                        <PincodeRow key={row.pincode} row={row} />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            {!isLoading && total > 0 && (
              <PaginationControls
                page={page}
                pageCount={pageCount}
                total={total}
                firstItem={firstItem}
                lastItem={lastItem}
                onPageChange={setPage}
                noun="pincodes"
              />
            )}
          </>
        )}
      </ClientPagination>
    </div>
  );
}

function BulkImportPanel() {
  const bulkImport = useBulkImportDeliveryPincodes();
  const [rows, setRows] = useState<DeliveryPincodePayload[]>([]);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const onFileChange = async (file: File | undefined) => {
    setError(null);
    setResult(null);
    setRows([]);
    setFileName(file?.name ?? "");
    if (!file) return;

    try {
      const parsed = await parseImportFile(file);
      if (parsed.length === 0) {
        setError("No valid delivery pincode rows found in this file.");
        return;
      }
      setRows(parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read file");
    }
  };

  const submit = async () => {
    setError(null);
    setResult(null);
    try {
      const response = await bulkImport.mutateAsync(rows);
      setResult(
        `Imported ${response.imported} pincode${response.imported === 1 ? "" : "s"}.`,
      );
      setRows([]);
      setFileName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    }
  };

  return (
    <div className="mb-5 rounded-card border border-dashed border-brand-300 bg-brand-50/40 p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <FileSpreadsheet className="h-4 w-4 text-brand-500" />
            Bulk import delivery pincodes
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Upload CSV, XLS, or XLSX. Expected columns: {IMPORT_COLUMNS}.
            Duplicate pincodes in the file are de-duplicated by the backend.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-brand-300 hover:text-brand-500">
            <Upload className="h-4 w-4" /> Choose file
            <input
              type="file"
              accept=".csv,.xls,.xlsx,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(event) => void onFileChange(event.target.files?.[0])}
              className="sr-only"
            />
          </label>
          <button
            type="button"
            disabled={rows.length === 0 || bulkImport.isPending}
            onClick={submit}
            className={cn(submitClass, "inline-flex items-center gap-1.5")}
          >
            Import {rows.length > 0 ? rows.length : ""}
          </button>
        </div>
      </div>

      {fileName && (
        <p className="mt-3 text-xs text-slate-600">
          Selected:{" "}
          <span className="font-medium text-slate-900">{fileName}</span>
        </p>
      )}
      {rows.length > 0 && (
        <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-3 py-2 text-xs font-medium text-slate-500">
            Previewing first {Math.min(rows.length, 5)} of {rows.length} valid
            rows
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Pincode</th>
                  <th className="px-3 py-2 font-medium">Area</th>
                  <th className="px-3 py-2 font-medium">District</th>
                  <th className="px-3 py-2 text-right font-medium">Fee</th>
                  <th className="px-3 py-2 text-right font-medium">
                    Min order
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.slice(0, 5).map((row) => (
                  <tr key={row.pincode}>
                    <td className="px-3 py-2 font-medium text-slate-900">
                      {row.pincode}
                    </td>
                    <td className="px-3 py-2 text-slate-600">{row.area}</td>
                    <td className="px-3 py-2 text-slate-600">{row.district}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                      ₹{row.deliveryFee}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                      {row.minOrderAmount ? `₹${row.minOrderAmount}` : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {result && (
        <p className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          {result}
        </p>
      )}
      {error && (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

async function parseImportFile(file: File): Promise<DeliveryPincodePayload[]> {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return [];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
  });
  return rawRows
    .map(normalizeImportRow)
    .filter((row): row is DeliveryPincodePayload => row !== null);
}

function normalizeImportRow(
  rawRow: Record<string, unknown>,
): DeliveryPincodePayload | null {
  const row = normalizedObject(rawRow);
  const pincode = String(row.pincode ?? "").trim();
  if (!pincodeIsValid(pincode)) return null;

  const district = parseDistrict(row.district);
  if (!district) return null;

  const deliveryFee = toNumberOrNull(
    row.deliveryfee ?? row.customerdeliveryfee,
  );
  if (deliveryFee === null) return null;

  const city = String(row.city || titleCase(district)).trim();
  const area = String(row.area ?? row.areaname ?? "").trim();

  return {
    pincode,
    city,
    area: area || null,
    district,
    deliveryFee,
    sameDayEligible: parseBoolean(row.samedayeligible, true),
    minOrderAmount: toNumberOrNull(row.minorderamount),
    extraLeadHours: toNumberOrNull(row.extraleadhours) ?? 0,
    notes: String(row.notes ?? "").trim() || null,
    isActive: parseBoolean(row.isactive, true),
    expressEligible: parseBoolean(row.expresseligible, true),
    expressDeliveryFee: toNumberOrNull(row.expressdeliveryfee),
  };
}

function normalizedObject(rawRow: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(rawRow).map(([key, value]) => [
      key.toLowerCase().replace(/[^a-z0-9]/g, ""),
      value,
    ]),
  );
}

function parseDistrict(value: unknown): DeliveryDistrict | null {
  const normalized = String(value ?? "")
    .trim()
    .toUpperCase();
  return DISTRICTS.includes(normalized as DeliveryDistrict)
    ? (normalized as DeliveryDistrict)
    : null;
}

function parseBoolean(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value;
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  if (["true", "yes", "y", "1"].includes(normalized)) return true;
  if (["false", "no", "n", "0"].includes(normalized)) return false;
  return fallback;
}

function titleCase(value: string) {
  return value.toLowerCase().replace(/^./, (letter) => letter.toUpperCase());
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-card border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function NewPincodeForm() {
  const create = useCreateDeliveryPincode();
  const [form, setForm] = useState<DeliveryPincodePayload>(emptyForm);
  const [error, setError] = useState<string | null>(null);

  const update = <K extends keyof DeliveryPincodePayload>(
    key: K,
    value: DeliveryPincodePayload[K],
  ) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async () => {
    setError(null);
    if (!pincodeIsValid(form.pincode)) {
      setError("Enter a valid 6-digit pincode.");
      return;
    }
    try {
      await create.mutateAsync({
        ...form,
        area: form.area || null,
        notes: form.notes || null,
        minOrderAmount: toNumberOrNull(form.minOrderAmount),
        expressDeliveryFee: toNumberOrNull(form.expressDeliveryFee),
      });
      setForm(emptyForm);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add pincode");
    }
  };

  return (
    <div className="rounded-card border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-6">
        <Field label="Pincode" required>
          <input
            value={form.pincode}
            onChange={(event) => update("pincode", event.target.value.trim())}
            placeholder="711202"
            className={inputClass}
          />
        </Field>
        <Field label="Area">
          <input
            value={form.area ?? ""}
            onChange={(event) => update("area", event.target.value)}
            placeholder="Belur"
            className={inputClass}
          />
        </Field>
        <Field label="City" required>
          <input
            value={form.city}
            onChange={(event) => update("city", event.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="District">
          <select
            value={form.district}
            onChange={(event) =>
              update("district", event.target.value as DeliveryDistrict)
            }
            className={selectClass}
          >
            {DISTRICTS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Fee (₹)">
          <input
            type="number"
            min={0}
            value={form.deliveryFee}
            onChange={(event) =>
              update("deliveryFee", Number(event.target.value))
            }
            className={inputClass}
          />
        </Field>
        <Field label="Min order">
          <input
            type="number"
            min={0}
            value={form.minOrderAmount ?? ""}
            onChange={(event) =>
              update("minOrderAmount", toNumberOrNull(event.target.value))
            }
            className={inputClass}
          />
        </Field>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
        <Field label="Notes">
          <input
            value={form.notes ?? ""}
            onChange={(event) => update("notes", event.target.value)}
            placeholder="Rider availability, local caveats, etc."
            className={inputClass}
          />
        </Field>
        <button
          type="button"
          disabled={create.isPending}
          onClick={submit}
          className={cn(
            submitClass,
            "inline-flex items-center justify-center gap-1.5",
          )}
        >
          <Plus className="h-4 w-4" /> Add pincode
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-600">
        <Checkbox
          label="Active"
          checked={form.isActive}
          onChange={(checked) => update("isActive", checked)}
        />
        <Checkbox
          label="Same-day eligible"
          checked={form.sameDayEligible}
          onChange={(checked) => update("sameDayEligible", checked)}
        />
        <Checkbox
          label="Express eligible"
          checked={form.expressEligible}
          onChange={(checked) => update("expressEligible", checked)}
        />
        <label className="inline-flex items-center gap-2">
          Extra lead hours
          <input
            type="number"
            min={0}
            value={form.extraLeadHours}
            onChange={(event) =>
              update("extraLeadHours", Number(event.target.value) || 0)
            }
            className="w-16 rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
          />
        </label>
        <label className="inline-flex items-center gap-2">
          Express fee
          <input
            type="number"
            min={0}
            value={form.expressDeliveryFee ?? ""}
            onChange={(event) =>
              update("expressDeliveryFee", toNumberOrNull(event.target.value))
            }
            className="w-20 rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
          />
        </label>
      </div>

      {error && (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

function PincodeRow({ row }: { row: AdminDeliveryPincode }) {
  const update = useUpdateDeliveryPincode();
  const del = useDeleteDeliveryPincode();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<DeliveryPincodePayload>({
    pincode: row.pincode,
    city: row.city,
    area: row.area ?? "",
    district: row.district,
    deliveryFee: Number(row.deliveryFee),
    sameDayEligible: row.sameDayEligible,
    minOrderAmount: toNumberOrNull(row.minOrderAmount),
    extraLeadHours: row.extraLeadHours,
    notes: row.notes ?? "",
    isActive: row.isActive,
    expressEligible: row.expressEligible,
    expressDeliveryFee: toNumberOrNull(row.expressDeliveryFee),
  });
  const [error, setError] = useState<string | null>(null);

  const updateDraft = <K extends keyof DeliveryPincodePayload>(
    key: K,
    value: DeliveryPincodePayload[K],
  ) => setDraft((current) => ({ ...current, [key]: value }));

  const save = async () => {
    setError(null);
    try {
      await update.mutateAsync({
        pincode: row.pincode,
        city: draft.city,
        area: draft.area || null,
        district: draft.district,
        deliveryFee: draft.deliveryFee,
        sameDayEligible: draft.sameDayEligible,
        minOrderAmount: toNumberOrNull(draft.minOrderAmount),
        extraLeadHours: draft.extraLeadHours,
        notes: draft.notes || null,
        isActive: draft.isActive,
        expressEligible: draft.expressEligible,
        expressDeliveryFee: toNumberOrNull(draft.expressDeliveryFee),
      });
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    }
  };

  if (editing) {
    return (
      <tr className="bg-brand-50/40 align-top">
        <td className="px-4 py-3" colSpan={8}>
          <div className="grid gap-3 lg:grid-cols-6">
            <Field label="Area">
              <input
                value={draft.area ?? ""}
                onChange={(event) => updateDraft("area", event.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="City">
              <input
                value={draft.city}
                onChange={(event) => updateDraft("city", event.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="District">
              <select
                value={draft.district}
                onChange={(event) =>
                  updateDraft(
                    "district",
                    event.target.value as DeliveryDistrict,
                  )
                }
                className={selectClass}
              >
                {DISTRICTS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Fee (₹)">
              <input
                type="number"
                min={0}
                value={draft.deliveryFee}
                onChange={(event) =>
                  updateDraft("deliveryFee", Number(event.target.value))
                }
                className={inputClass}
              />
            </Field>
            <Field label="Min order">
              <input
                type="number"
                min={0}
                value={draft.minOrderAmount ?? ""}
                onChange={(event) =>
                  updateDraft(
                    "minOrderAmount",
                    toNumberOrNull(event.target.value),
                  )
                }
                className={inputClass}
              />
            </Field>
            <Field label="Lead hours">
              <input
                type="number"
                min={0}
                value={draft.extraLeadHours}
                onChange={(event) =>
                  updateDraft("extraLeadHours", Number(event.target.value) || 0)
                }
                className={inputClass}
              />
            </Field>
          </div>
          <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
            <Field label="Notes">
              <input
                value={draft.notes ?? ""}
                onChange={(event) => updateDraft("notes", event.target.value)}
                className={inputClass}
              />
            </Field>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={save}
                disabled={update.isPending}
                className={cn(submitClass, "inline-flex items-center gap-1.5")}
              >
                <Save className="h-4 w-4" /> Save
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <X className="h-4 w-4" /> Cancel
              </button>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-600">
            <Checkbox
              label="Active"
              checked={draft.isActive}
              onChange={(checked) => updateDraft("isActive", checked)}
            />
            <Checkbox
              label="Same-day eligible"
              checked={draft.sameDayEligible}
              onChange={(checked) => updateDraft("sameDayEligible", checked)}
            />
            <Checkbox
              label="Express eligible"
              checked={draft.expressEligible}
              onChange={(checked) => updateDraft("expressEligible", checked)}
            />
            <label className="inline-flex items-center gap-2">
              Express fee
              <input
                type="number"
                min={0}
                value={draft.expressDeliveryFee ?? ""}
                onChange={(event) =>
                  updateDraft(
                    "expressDeliveryFee",
                    toNumberOrNull(event.target.value),
                  )
                }
                className="w-20 rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
              />
            </label>
          </div>
          {error && (
            <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </p>
          )}
        </td>
      </tr>
    );
  }

  return (
    <tr className="hover:bg-slate-50">
      <td className="px-4 py-3">
        <p className="font-medium text-slate-900">
          {row.area || "Unnamed area"}
        </p>
        <p className="text-xs text-slate-500">
          {row.pincode} · {row.city} · {row.district}
        </p>
        {row.notes && (
          <p className="mt-1 text-xs text-slate-400">{row.notes}</p>
        )}
      </td>
      <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-900">
        ₹{Number(row.deliveryFee)}
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-slate-700">
        {row.minOrderAmount ? `₹${Number(row.minOrderAmount)}` : "—"}
      </td>
      <td className="px-4 py-3 text-center">
        <StatusPill
          active={row.sameDayEligible}
          label={row.sameDayEligible ? "Yes" : "No"}
        />
      </td>
      <td className="px-4 py-3 text-center">
        <StatusPill
          active={row.expressEligible}
          label={row.expressEligible ? "Yes" : "No"}
        />
      </td>
      <td className="px-4 py-3 text-center tabular-nums text-slate-700">
        +{row.extraLeadHours}h
      </td>
      <td className="px-4 py-3 text-center">
        <StatusPill
          active={row.isActive}
          label={row.isActive ? "Active" : "Off"}
        />
      </td>
      <td className="px-4 py-3 text-right">
        <div className="inline-flex gap-1">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-md border border-slate-200 p-1.5 text-slate-500 transition hover:border-brand-500 hover:text-brand-500"
            title="Edit"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirm(`Delete delivery pincode ${row.pincode}?`)) {
                del.mutate(row.pincode, {
                  onError: (err) =>
                    alert(err instanceof Error ? err.message : "Delete failed"),
                });
              }
            }}
            className="rounded-md border border-slate-200 p-1.5 text-slate-500 transition hover:border-red-500 hover:text-red-600"
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500"
      />
      {label}
    </label>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-lg px-3 py-1.5 text-sm font-medium transition",
        active
          ? "bg-brand-500 text-white shadow-sm"
          : "bg-slate-100 text-slate-600 hover:bg-slate-200",
      )}
    >
      {children}
    </button>
  );
}

function StatusPill({ active, label }: { active: boolean; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-xs font-medium",
        active
          ? "bg-emerald-50 text-emerald-700"
          : "bg-slate-100 text-slate-500",
      )}
    >
      {label}
    </span>
  );
}
