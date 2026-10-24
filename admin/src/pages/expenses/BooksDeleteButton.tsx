import { Trash2 } from "lucide-react";

export function BooksDeleteButton({
  confirm,
  pending,
  onDelete,
}: {
  confirm: string;
  pending: boolean;
  onDelete: () => void | Promise<void>;
}) {
  return (
    <button
      type="button"
      title="Delete"
      disabled={pending}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!window.confirm(confirm)) return;
        void onDelete();
      }}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-red-500 transition hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
    >
      <Trash2 className="h-4 w-4" />
      <span className="sr-only">Delete</span>
    </button>
  );
}
