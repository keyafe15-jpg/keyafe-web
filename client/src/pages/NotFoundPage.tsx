import { Link } from "react-router-dom";
import { NOT_FOUND_COPY } from "@/content/misc";

export function NotFoundPage() {
  return (
    <section className="mx-auto max-w-lg px-4 py-24 text-center">
      <h1 className="mb-3 text-5xl">{NOT_FOUND_COPY.code}</h1>
      <p className="mb-6 text-ink-500">{NOT_FOUND_COPY.body}</p>
      <Link to="/" className="text-brand-500 hover:underline">
        {NOT_FOUND_COPY.backLink}
      </Link>
    </section>
  );
}
