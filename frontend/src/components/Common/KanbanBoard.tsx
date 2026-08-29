import { useState, type ReactNode } from "react";
import { Pencil } from "lucide-react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { cn } from "@/lib/utils";

export interface KanbanColumn {
  id: string;
  label: string;
  accentClass?: string;
}

interface KanbanBoardProps<T extends { id: string }> {
  columns: KanbanColumn[];
  items: T[];
  getColumnId: (item: T) => string;
  renderCard: (item: T) => ReactNode;
  onMove: (itemId: string, newColumnId: string) => void;
  emptyMessage?: string;
  /** When provided, column headers become click-to-rename (a text input replaces the label). */
  onRenameColumn?: (columnId: string, newLabel: string) => void;
}

function ColumnHeader({ column, onRename }: { column: KanbanColumn; onRename?: (label: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(column.label);

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setEditing(false);
          if (draft.trim() && draft !== column.label) onRename?.(draft.trim());
          else setDraft(column.label);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            setDraft(column.label);
            setEditing(false);
          }
        }}
        className="w-full rounded-md border border-aurora-accent bg-white px-1.5 py-0.5 text-sm font-semibold outline-none"
      />
    );
  }

  return (
    <button
      onClick={() => onRename && setEditing(true)}
      disabled={!onRename}
      className={cn("group flex items-center gap-1 text-sm font-semibold", column.accentClass ?? "text-aurora-text/80")}
    >
      {column.label}
      {onRename && <Pencil size={11} className="opacity-0 transition group-hover:opacity-50" />}
    </button>
  );
}

function DraggableCard({ id, children }: { id: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn("cursor-grab touch-none transition-opacity duration-150 active:cursor-grabbing", isDragging && "opacity-30")}
    >
      {children}
    </div>
  );
}

function DroppableColumn({ id, children }: { id: string; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex h-full flex-col gap-2 overflow-y-auto rounded-2xl border border-black/5 bg-white p-2 transition-colors duration-150",
        isOver && "border-aurora-accent/30 bg-aurora-accent/[0.05]",
      )}
    >
      {children}
    </div>
  );
}

/** Generic drag-and-drop board: columns hold items, dragging a card between columns fires onMove. */
export function KanbanBoard<T extends { id: string }>({
  columns,
  items,
  getColumnId,
  renderCard,
  onMove,
  emptyMessage = "Nothing here yet",
  onRenameColumn,
}: KanbanBoardProps<T>) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const [activeId, setActiveId] = useState<string | null>(null);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    const itemId = String(active.id);
    const newColumnId = String(over.id);
    const item = items.find((i) => i.id === itemId);
    if (item && getColumnId(item) !== newColumnId) {
      onMove(itemId, newColumnId);
    }
  };

  const activeItem = activeId ? items.find((i) => i.id === activeId) : undefined;

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={() => setActiveId(null)}>
      <div className="flex min-h-[70vh] flex-1 gap-4 overflow-x-auto pb-2">
        {columns.map((column) => {
          const columnItems = items.filter((item) => getColumnId(item) === column.id);
          return (
            <div key={column.id} className="flex min-w-[240px] flex-1 flex-col">
              <div className="mb-2 flex items-center justify-between gap-2 px-1">
                <ColumnHeader column={column} onRename={onRenameColumn ? (label) => onRenameColumn(column.id, label) : undefined} />
                <span className="shrink-0 rounded-full bg-black/5 px-2 py-0.5 text-xs font-medium text-aurora-text/50">{columnItems.length}</span>
              </div>
              <DroppableColumn id={column.id}>
                {columnItems.length === 0 ? (
                  <p className="px-2 py-6 text-center text-xs text-aurora-text/30">{emptyMessage}</p>
                ) : (
                  columnItems.map((item) => (
                    <DraggableCard key={item.id} id={item.id}>
                      {renderCard(item)}
                    </DraggableCard>
                  ))
                )}
              </DroppableColumn>
            </div>
          );
        })}
      </div>
      <DragOverlay dropAnimation={{ duration: 150, easing: "ease-out" }}>
        {activeItem ? <div className="rotate-1 cursor-grabbing shadow-glass-hover">{renderCard(activeItem)}</div> : null}
      </DragOverlay>
    </DndContext>
  );
}
