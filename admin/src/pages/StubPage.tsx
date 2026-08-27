export function StubPage({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      <div className="rounded-card border border-dashed border-slate-200 bg-white px-6 py-16 text-center">
        <p className="text-sm text-slate-500">This section is not built yet.</p>
        <p className="mt-1 text-xs text-slate-400">
          Coming in the next admin pass.
        </p>
      </div>
    </div>
  );
}
