import { useEffect, useState } from "react";
import {
  useAdminAnnouncement,
  useUpdateAnnouncement,
} from "@/hooks/useAnnouncement";
import { Field, inputClass, submitClass } from "@/components/form/Field";

export function AnnouncementPage() {
  const { data, isLoading } = useAdminAnnouncement();
  const update = useUpdateAnnouncement();
  const [enabled, setEnabled] = useState(false);
  const [text, setText] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!data) return;
    setEnabled(data.announcementEnabled);
    setText(data.announcementText);
    setLinkUrl(data.announcementLinkUrl ?? "");
    setLinkLabel(data.announcementLinkLabel ?? "");
  }, [data]);

  const submit = async () => {
    setSaved(false);
    await update.mutateAsync({
      announcementEnabled: enabled,
      announcementText: text.trim(),
      announcementLinkUrl: linkUrl.trim() || null,
      announcementLinkLabel: linkLabel.trim() || null,
    });
    setSaved(true);
  };

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-semibold text-slate-900">Announcement</h1>
      <p className="mt-1 text-sm text-slate-500">
        Slim pink bar at the top of the website. Turn it off when the message
        is done.
      </p>

      <section className="mt-6 rounded-card border border-slate-200 bg-white p-5">
        {isLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : (
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
            <Field
              label="Message"
              hint={`${text.length}/160 · Keep it to one line.`}
            >
              <input
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, 160))}
                placeholder="Pan-India shipping is open on cookies & brownies"
                className={inputClass}
              />
            </Field>
            <Field
              label="Link (optional)"
              hint="Site path like /pan-india, or a https URL."
            >
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
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={submit}
                disabled={update.isPending}
                className={submitClass}
              >
                {update.isPending ? "Saving…" : "Save announcement"}
              </button>
              {saved && !update.isPending && (
                <span className="text-xs text-emerald-700">Saved</span>
              )}
              {update.isError && (
                <span className="text-xs text-brand-600">
                  {update.error instanceof Error
                    ? update.error.message
                    : "Could not save"}
                </span>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
