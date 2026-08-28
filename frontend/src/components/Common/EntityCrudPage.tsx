import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Plus, Pencil, Trash2, Search, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { api, getApiErrorMessage } from "@/lib/api";
import { GlassCard } from "@/components/Common/GlassCard";
import { AuroraButton } from "@/components/Common/AuroraButton";
import { GlassInput, GlassSelect, GlassTextarea } from "@/components/Common/GlassInput";
import { Modal } from "@/components/Common/Modal";
import { Table, type Column } from "@/components/Common/Table";
import { useToast } from "@/components/Common/Toast";
import { Toggle } from "@/components/Common/Toggle";
import { useAuth } from "@/hooks/useAuth";

export type FieldType = "text" | "email" | "number" | "date" | "datetime-local" | "time" | "select" | "textarea" | "checkbox" | "tags";

export interface FieldDef {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: { value: string; label: string }[];
  /** For "select" fields backed by another resource (e.g. a guest/room picker): fetched once on mount. */
  optionsEndpoint?: string;
  /** Maps a row from optionsEndpoint's paginated `data` to {value,label}. Defaults to id + a guessed name field. */
  mapOption?: (row: Record<string, unknown>) => { value: string; label: string };
  placeholder?: string;
  step?: string;
  hint?: string;
}

function defaultMapOption(row: Record<string, unknown>): { value: string; label: string } {
  const label =
    [row.firstName, row.lastName].filter(Boolean).join(" ") ||
    (row.name as string) ||
    (row.title as string) ||
    (row.email as string) ||
    String(row.id ?? "");
  return { value: String(row.id), label };
}

interface PaginatedResponse<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface EntityCrudPageProps<T extends Record<string, unknown>> {
  title: string;
  description?: string;
  resource: string;
  columns: Column<T>[];
  fields: FieldDef[];
  keyField?: keyof T;
  searchPlaceholder?: string;
  toolbarExtra?: ReactNode;
  rowActions?: (row: T) => ReactNode;
  canCreate?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  canExport?: boolean;
  onBeforeSubmit?: (values: Record<string, unknown>) => Record<string, unknown>;
}

function emptyFormState(fields: FieldDef[]): Record<string, unknown> {
  const state: Record<string, unknown> = {};
  for (const field of fields) {
    state[field.name] = field.type === "checkbox" ? false : "";
  }
  return state;
}

export function EntityCrudPage<T extends Record<string, unknown>>({
  title,
  description,
  resource,
  columns,
  fields,
  keyField = "id" as keyof T,
  searchPlaceholder = "Search...",
  toolbarExtra,
  rowActions,
  canCreate = true,
  canEdit = true,
  canDelete,
  canExport = true,
  onBeforeSubmit,
}: EntityCrudPageProps<T>) {
  const { show } = useToast();
  const { user } = useAuth();
  // Backend already enforces this (staff can't call DELETE on module routes);
  // default the button off for staff too so it doesn't dangle as a 403 trap.
  // An explicit canDelete prop always wins.
  const effectiveCanDelete = canDelete ?? user?.role !== "staff";
  const [rows, setRows] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<string | undefined>(undefined);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [isLoading, setIsLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<T | null>(null);
  const [formValues, setFormValues] = useState<Record<string, unknown>>(emptyFormState(fields));
  const [isSaving, setIsSaving] = useState(false);
  const [deletingRow, setDeletingRow] = useState<T | null>(null);
  const [dynamicOptions, setDynamicOptions] = useState<Record<string, { value: string; label: string }[]>>({});

  useEffect(() => {
    const withEndpoints = fields.filter((f) => f.optionsEndpoint);
    if (withEndpoints.length === 0) return;
    void Promise.all(
      withEndpoints.map(async (field) => {
        const { data } = await api.get<PaginatedResponse<Record<string, unknown>>>(field.optionsEndpoint!, { params: { pageSize: 200 } });
        const mapper = field.mapOption ?? defaultMapOption;
        return [field.name, data.data.map(mapper)] as const;
      }),
    ).then((entries) => setDynamicOptions(Object.fromEntries(entries)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalOpen]);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data } = await api.get<PaginatedResponse<T>>(resource, {
        params: { page, pageSize, search: search || undefined, sortBy, sortDir },
      });
      setRows(data.data);
      setTotal(data.total);
    } catch (err) {
      show(getApiErrorMessage(err, "Failed to load records"), "error");
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resource, page, pageSize, search, sortBy, sortDir]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditingRow(null);
    setFormValues(emptyFormState(fields));
    setModalOpen(true);
  };

  const openEdit = (row: T) => {
    setEditingRow(row);
    const values: Record<string, unknown> = {};
    for (const field of fields) {
      const raw = row[field.name];
      values[field.name] = field.type === "tags" && Array.isArray(raw) ? raw.join(", ") : (raw ?? (field.type === "checkbox" ? false : ""));
    }
    setFormValues(values);
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    setIsSaving(true);
    try {
      let payload: Record<string, unknown> = { ...formValues };
      for (const field of fields) {
        if (field.type === "tags" && typeof payload[field.name] === "string") {
          payload[field.name] = (payload[field.name] as string)
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
        }
        if (field.type === "number" && payload[field.name] === "") {
          payload[field.name] = undefined;
        }
      }
      if (onBeforeSubmit) payload = onBeforeSubmit(payload);

      if (editingRow) {
        await api.patch(`${resource}/${editingRow[keyField]}`, payload);
        show("Updated successfully", "success");
      } else {
        await api.post(resource, payload);
        show("Created successfully", "success");
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      show(getApiErrorMessage(err, "Failed to save record"), "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingRow) return;
    try {
      await api.delete(`${resource}/${deletingRow[keyField]}`);
      show("Deleted successfully", "success");
      setDeletingRow(null);
      await load();
    } catch (err) {
      show(getApiErrorMessage(err, "Failed to delete record"), "error");
    }
  };

  const handleExport = async () => {
    try {
      const response = await api.get(`${resource}/export`, { params: { search: search || undefined }, responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${title.toLowerCase().replace(/\s+/g, "-")}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      show(getApiErrorMessage(err, "Export failed"), "error");
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="animate-fade-in flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2>{title}</h2>
          {description && <p className="mt-1 text-sm text-aurora-text/60">{description}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {toolbarExtra}
          {canExport && (
            <AuroraButton variant="ghost" size="sm" icon={<Download size={16} />} onClick={handleExport}>
              Export
            </AuroraButton>
          )}
          {canCreate && (
            <AuroraButton size="sm" icon={<Plus size={16} />} onClick={openCreate}>
              Add {title.replace(/s$/, "")}
            </AuroraButton>
          )}
        </div>
      </div>

      <GlassCard padding="sm" className="flex items-center gap-2">
        <Search size={16} className="text-aurora-text/40" />
        <input
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
          placeholder={searchPlaceholder}
          className="w-full bg-transparent text-sm outline-none placeholder:text-aurora-text/40"
        />
      </GlassCard>

      <Table
        columns={columns}
        data={rows}
        keyField={keyField}
        isLoading={isLoading}
        sortBy={sortBy}
        sortDir={sortDir}
        onSort={(key) => {
          if (sortBy === key) {
            setSortDir(sortDir === "asc" ? "desc" : "asc");
          } else {
            setSortBy(key);
            setSortDir("desc");
          }
        }}
        actions={(row) => (
          <div className="flex justify-end gap-1">
            {rowActions?.(row)}
            {canEdit && (
              <button onClick={() => openEdit(row)} className="rounded-lg p-1.5 text-aurora-text/60 transition hover:bg-black/10 hover:text-aurora-cyan" aria-label="Edit">
                <Pencil size={16} />
              </button>
            )}
            {effectiveCanDelete && (
              <button onClick={() => setDeletingRow(row)} className="rounded-lg p-1.5 text-aurora-text/60 transition hover:bg-black/10 hover:text-aurora-error" aria-label="Delete">
                <Trash2 size={16} />
              </button>
            )}
          </div>
        )}
      />

      <div className="flex items-center justify-between text-sm text-aurora-text/60">
        <span>
          {total === 0 ? "0 results" : `Showing ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total}`}
        </span>
        <div className="flex items-center gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-lg p-1.5 hover:bg-black/10 disabled:opacity-30"
          >
            <ChevronLeft size={16} />
          </button>
          <span>
            Page {page} of {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="rounded-lg p-1.5 hover:bg-black/10 disabled:opacity-30"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingRow ? `Edit ${title.replace(/s$/, "")}` : `Add ${title.replace(/s$/, "")}`}
        footer={
          <>
            <AuroraButton variant="ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </AuroraButton>
            <AuroraButton isLoading={isSaving} onClick={handleSubmit}>
              {editingRow ? "Save changes" : "Create"}
            </AuroraButton>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {fields.map((field) => (
            <div key={field.name} className={field.type === "textarea" ? "sm:col-span-2" : ""}>
              {field.type === "select" ? (
                <GlassSelect
                  label={field.label}
                  required={field.required}
                  options={field.optionsEndpoint ? (dynamicOptions[field.name] ?? []) : (field.options ?? [])}
                  placeholder={field.placeholder ?? `Select ${field.label.toLowerCase()}`}
                  value={(formValues[field.name] as string) ?? ""}
                  onChange={(e) => setFormValues((prev) => ({ ...prev, [field.name]: e.target.value }))}
                />
              ) : field.type === "textarea" ? (
                <GlassTextarea
                  label={field.label}
                  required={field.required}
                  rows={3}
                  placeholder={field.placeholder}
                  value={(formValues[field.name] as string) ?? ""}
                  onChange={(e) => setFormValues((prev) => ({ ...prev, [field.name]: e.target.value }))}
                />
              ) : field.type === "checkbox" ? (
                <div className="mt-6">
                  <Toggle
                    label={field.label}
                    checked={Boolean(formValues[field.name])}
                    onChange={(checked) => setFormValues((prev) => ({ ...prev, [field.name]: checked }))}
                  />
                </div>
              ) : (
                <GlassInput
                  label={field.label}
                  type={field.type === "tags" ? "text" : field.type}
                  step={field.step}
                  required={field.required}
                  hint={field.type === "tags" ? "Comma-separated" : field.hint}
                  placeholder={field.placeholder}
                  value={(formValues[field.name] as string) ?? ""}
                  onChange={(e) => setFormValues((prev) => ({ ...prev, [field.name]: e.target.value }))}
                />
              )}
            </div>
          ))}
        </div>
      </Modal>

      <Modal
        open={Boolean(deletingRow)}
        onClose={() => setDeletingRow(null)}
        title="Confirm deletion"
        size="sm"
        footer={
          <>
            <AuroraButton variant="ghost" onClick={() => setDeletingRow(null)}>
              Cancel
            </AuroraButton>
            <AuroraButton variant="danger" onClick={handleDelete}>
              Delete
            </AuroraButton>
          </>
        }
      >
        <p className="text-sm text-aurora-text/70">This action cannot be undone. Are you sure you want to delete this record?</p>
      </Modal>
    </div>
  );
}
