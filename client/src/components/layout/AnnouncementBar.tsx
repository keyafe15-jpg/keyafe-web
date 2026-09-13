import { Link } from "react-router-dom";
import { usePublicAnnouncement } from "@/hooks/useAnnouncement";

export function AnnouncementBar() {
  const { data } = usePublicAnnouncement();
  if (!data?.text) return null;

  const label = data.linkLabel?.trim() || "Learn more";
  const href = data.linkUrl?.trim() || null;
  const isInternal = Boolean(href?.startsWith("/") && !href.startsWith("//"));

  return (
    <div className="bg-brand-500 px-4 py-2 text-center text-xs text-white sm:text-sm">
      <span>{data.text}</span>
      {href && isInternal && (
        <>
          {" "}
          <Link to={href} className="font-semibold underline underline-offset-2">
            {label}
          </Link>
        </>
      )}
      {href && !isInternal && (
        <>
          {" "}
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="font-semibold underline underline-offset-2"
          >
            {label}
          </a>
        </>
      )}
    </div>
  );
}
