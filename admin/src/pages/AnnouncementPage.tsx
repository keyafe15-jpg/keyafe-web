import { useEffect, useState } from "react";
import { Pencil, Megaphone } from "lucide-react";
import { useAdminAnnouncement, useUpdateAnnouncement } from "@/hooks/useAnnouncement";
import { Field, inputClass, submitClass } from "@/components/form/Field";
import { cn } from "@/lib/cn";

export function AnnouncementPage() {
  const { data, isLoading } = useAdminAnnouncement();
  const update = useUpdateAnnouncement();
  const [editing, setEditing] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [text, setText] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    setEnabled(data.announcementEnabled);
    setText(data.announcementText);
    setLinkUrl(data.announcementLinkUrl ?? "");
    setLinkLabel(data.announcementLinkLabel ?? "");
    // First load: open the form only when nothing is saved yet.
    setEditing((prev) => (data.announcementText.trim() ? prev : true));
  }, [data]);

  const hasSavedAnnouncement = Boolean(data?.announcementText.trim());
  const showForm = editing || !hasSavedAnnouncement;

  const syncFromData = () => {
    if (!data) return;
    setEnabled(data.announcementEnabled);
    setText(data.announcementText);
    setLinkUrl(data.announcementLinkUrl ?? "");
    setLinkLabel(data.announcementLinkLabel ?? "");
  };

  const startEdit = () => {
    syncFromData();
    setError(null);
    setEditing(true);
  };

  const cancelEdit = () => {
    syncFromData();
    setError(null);
    setEditing(false);
  };

  const submit = async () => {
    setError(null);
    try {
      await update.mutateAsync({
        announcementEnabled: enabled,
        announcementText: text.trim(),
        announcementLinkUrl: linkUrl.trim() || null,
        announcementLinkLabel: linkLabel.trim() || null,
      });
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    }
  };

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-semibold text-slate-900">Announcement</h1>
      <p className="mt-1 text-sm text-slate-500">
        Slim pink bar at the top of the website. Turn it off when the message is done.
      </p>

      <section className="mt-6 space-y-4">
        {isLoading ? (
          <div className="rounded-card border border-slate-200 bg-white p-5 text-sm text-slate-500">
            Loading…
          </div>
        ) : showForm ? (
          <div className="rounded-card border border-slate-200 bg-white p-5">
            <div className="space-y-4">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-brand-500"
                />
                Show announcement bar
              </label>
              <Field label="Message" hint={`${text.length}/160 · Keep it to one line.`}>
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value.slice(0, 160))}
                  placeholder="Pan-India shipping is open on cookies & brownies"
                  className={inputClass}
                />
              </Field>
              <Field label="Link (optional)" hint="Site path like /pan-india, or a https URL.">
                <input
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="/pan-india"
                  className={inputClass}
                />
              </Field>
              <Field label="Link label (optional)">
                <input
                  value={linkLabel}
                  onChange={(e) => setLinkLabel(e.target.value)}
                  placeholder="Shop now"
                  className={inputClass}
                />
              </Field>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => void submit()}
                  disabled={update.isPending}
                  className={submitClass}
                >
                  {update.isPending ? "Saving…" : "Save announcement"}
                </button>
                {hasSavedAnnouncement && (
                  <button
                    type="button"
                    onClick={cancelEdit}
                    disabled={update.isPending}
                    className="text-sm font-medium text-slate-500 hover:text-slate-800"
                  >
                    Cancel
                  </button>
                )}
                {error && <span className="text-xs text-brand-600">{error}</span>}
              </div>
            </div>
          </div>
        ) : (
          <AnnouncementCard
            enabled={data!.announcementEnabled}
            text={data!.announcementText}
            linkUrl={data!.announcementLinkUrl}
            linkLabel={data!.announcementLinkLabel}
            onEdit={startEdit}
          />
        )}
      </section>
    </div>
  );
}

function AnnouncementCard({
  enabled,
  text,
  linkUrl,
  linkLabel,
  onEdit,
}: {
  enabled: boolean;
  text: string;
  linkUrl: string | null;
  linkLabel: string | null;
  onEdit: () => void;
}) {
  const label = linkLabel?.trim() || "Learn more";
  const href = linkUrl?.trim() || null;

  return (
    <div className="rounded-card border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            <Megaphone className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-900">Current announcement</p>
            <p
              className={cn(
                "mt-0.5 text-xs font-medium",
                enabled ? "text-emerald-700" : "text-slate-500",
              )}
            >
              {enabled ? "Live on the storefront" : "Saved · hidden on the storefront"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:border-brand-300 hover:text-brand-700"
        >
          <Pencil className="h-3 w-3" /> Edit
        </button>
      </div>

      <div className="mt-4 overflow-hidden rounded-lg">
        <div className="bg-brand-500 px-4 py-2.5 text-center text-sm text-white">
          <span>{text}</span>
          {href && (
            <>
              {" "}
              <span className="font-semibold underline underline-offset-2">{label}</span>
            </>
          )}
        </div>
      </div>

      {(href || linkLabel) && (
        <dl className="mt-3 space-y-1 text-xs text-slate-500">
          {href && (
            <div className="flex gap-2">
              <dt className="shrink-0 font-medium text-slate-600">Link</dt>
              <dd className="truncate">{href}</dd>
            </div>
          )}
          {linkLabel && (
            <div className="flex gap-2">
              <dt className="shrink-0 font-medium text-slate-600">Label</dt>
              <dd>{linkLabel}</dd>
            </div>
          )}
        </dl>
      )}
    </div>
  );
}
