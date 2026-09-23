import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  createElement,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/cn";

export type ReorderItemContext = {
  /** Attach to the row/card container (ref + transform + drag attrs if no handle). */
  setNodeRef: (node: HTMLElement | null) => void;
  style: CSSProperties;
  isDragging: boolean;
  /**
   * Spread onto a dedicated grip control. Prefer this when the row has
   * inputs/buttons so those stay clickable.
   */
  handleProps: HTMLAttributes<HTMLElement>;
  /** Spread onto the whole item to drag from anywhere (skip if using handleProps). */
  itemDragProps: HTMLAttributes<HTMLElement>;
};

type ReorderListProps<T> = {
  items: T[];
  getId?: (item: T) => string;
  onReorder: (next: T[]) => void;
  children: (item: T, ctx: ReorderItemContext) => ReactNode;
  className?: string;
  /** Wrapper element — use `tbody` inside tables. */
  as?: "div" | "ul" | "ol" | "tbody";
  disabled?: boolean;
};

/**
 * Drag-and-drop reorder wrapper. Render your row/card via `children`; use
 * `ctx.handleProps` on a grip (or `ctx.itemDragProps` on the whole item).
 *
 * @example
 * <ReorderList items={rows} onReorder={setRows} as="tbody">
 *   {(row, ctx) => (
 *     <tr ref={ctx.setNodeRef} style={ctx.style}>
 *       <td><ReorderHandle {...ctx.handleProps} /></td>
 *       <td>{row.name}</td>
 *     </tr>
 *   )}
 * </ReorderList>
 */
export function ReorderList<T>({
  items,
  getId = defaultGetId,
  onReorder,
  children,
  className,
  as = "div",
  disabled = false,
}: ReorderListProps<T>) {
  const ids = items.map(getId);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(items, oldIndex, newIndex));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy} disabled={disabled}>
        {createElement(
          as,
          { className },
          items.map((item) => (
            <SortableItem key={getId(item)} id={getId(item)} disabled={disabled}>
              {(ctx) => children(item, ctx)}
            </SortableItem>
          )),
        )}
      </SortableContext>
    </DndContext>
  );
}

function SortableItem({
  id,
  disabled,
  children,
}: {
  id: string;
  disabled?: boolean;
  children: (ctx: ReorderItemContext) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    position: "relative",
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.7 : undefined,
  };

  const handleProps: HTMLAttributes<HTMLElement> = {
    ...attributes,
    ...listeners,
  };

  const itemDragProps: HTMLAttributes<HTMLElement> = {
    ...attributes,
    ...listeners,
  };

  return <>{children({ setNodeRef, style, isDragging, handleProps, itemDragProps })}</>;
}

/** Optional grip button — spread `handleProps` from ReorderList context. */
export function ReorderHandle({
  className,
  ...props
}: HTMLAttributes<HTMLButtonElement> & { className?: string }) {
  return (
    <button
      type="button"
      aria-label="Drag to reorder"
      title="Drag to reorder"
      className={cn(
        "inline-flex h-8 w-8 cursor-grab items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 active:cursor-grabbing",
        className,
      )}
      {...props}
    >
      <GripVertical className="h-4 w-4" />
    </button>
  );
}

function defaultGetId<T>(item: T): string {
  if (item && typeof item === "object" && "id" in item) {
    return String((item as { id: unknown }).id);
  }
  throw new Error("ReorderList: item has no id — pass getId");
}

export { arrayMove };
