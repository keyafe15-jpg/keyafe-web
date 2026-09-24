import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

/** Thumbnail that opens a large preview dialog for kitchen / admin review. */
export function ImageLightboxThumb({
  src,
  alt = "",
  className,
}: {
  src: string;
  alt?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className={cn(
            "shrink-0 overflow-hidden rounded-md ring-offset-2 transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
            className,
          )}
          aria-label="View larger image"
        >
          <img src={src} alt={alt} className="h-full w-full object-cover" />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 flex max-h-[92vh] w-[min(96vw,56rem)] -translate-x-1/2 -translate-y-1/2 flex-col focus:outline-none">
          <Dialog.Title className="sr-only">Image preview</Dialog.Title>
          <Dialog.Description className="sr-only">
            Full-size reference image. Press Escape or click close to dismiss.
          </Dialog.Description>
          <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
            <Dialog.Close
              className="absolute top-3 right-3 z-10 rounded-full bg-slate-900/70 p-1.5 text-white transition hover:bg-slate-900"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </Dialog.Close>
            <img
              src={src}
              alt={alt}
              className="max-h-[88vh] w-full object-contain"
            />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
