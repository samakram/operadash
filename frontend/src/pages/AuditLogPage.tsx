import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ScrollText, ChevronLeft, ChevronRight } from "lucide-react";
import { api, getApiErrorMessage } from "@/lib/api";
import { GlassCard } from "@/components/Common/GlassCard";
import { GlassSelect } from "@/components/Common/GlassInput";
import { LoadingSpinner } from "@/components/Common/LoadingSpinner";
import { useToast } from "@/components/Common/Toast";
import { titleCase } from "@/lib/utils";

interface AuditLogRow {
  id: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string | null;
  changes: unknown;
  ipAddress: string | null;
  timestamp: string;
  user: { id: string; firstName: string | null; lastName: string | null; email: string } | null;
}

interface PaginatedResponse {
  data: AuditLogRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const ACTION_BADGE: Record<string, string> = {
  create: "border-aurora-success/40 text-aurora-success",
  update: "border-aurora-accent/40 text-aurora-accent",
  delete: "border-aurora-error/40 text-aurora-error",
  adjust: "border-aurora-warning/40 text-aurora-warning",
  impersonate: "border-aurora-warning/40 text-aurora-warning",
  bulk_mark: "border-aurora-accent/40 text-aurora-accent",
};

export default function AuditLogPage() {
  const { show } = useToast();
  const { id: routeTenantId } = useParams<{ id: string }>();
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [isLoading, setIsLoading] = useState(true);
  const [facets, setFacets] = useState<{ actions: string[]; entityTypes: string[] }>({ actions: [], entityTypes: [] });
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");

  useEffect(() => {
    api
      .get<{ actions: string[]; entityTypes: string[] }>("/audit-logs/facets", { params: { tenantId: routeTenantId } })
      .then(({ data }) => setFacets(data))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeTenantId]);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data } = await api.get<PaginatedResponse>("/audit-logs", {
        params: { page, pageSize, action: action || undefined, entityType: entityType || undefined, tenantId: routeTenantId },
      });
      setRows(data.data);
      setTotal(data.total);
    } catch (err) {
      show(getApiErrorMessage(err, "Failed to load audit log"), "error");
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, action, entityType, routeTenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="animate-fade-in flex flex-col gap-5">
      <div>
        <h2>Audit Log</h2>
        <p className="mt-1 text-sm text-aurora-text/60">Every create, update, and delete recorded across your account</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="w-48">
          <GlassSelect
            options={facets.actions.map((a) => ({ value: a, label: titleCase(a) }))}
            placeholder="All actions"
            value={action}
            onChange={(e) => {
              setPage(1);
              setAction(e.target.value);
            }}
          />
        </div>
        <div className="w-56">
          <GlassSelect
            options={facets.entityTypes.map((t) => ({ value: t, label: t }))}
            placeholder="All record types"
            value={entityType}
            onChange={(e) => {
              setPage(1);
              setEntityType(e.target.value);
            }}
          />
        </div>
      </div>

      {isLoading ? (
        <LoadingSpinner fullscreen />
      ) : rows.length === 0 ? (
        <GlassCard className="py-16 text-center text-aurora-text/50">
          <ScrollText className="mx-auto mb-2 opacity-40" size={28} />
          No activity recorded yet.
        </GlassCard>
      ) : (
        <GlassCard padding="none" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-black/10 text-xs uppercase tracking-wide text-aurora-text/50">
                  <th className="px-4 py-3 font-medium">When</th>
                  <th className="px-4 py-3 font-medium">Who</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                  <th className="px-4 py-3 font-medium">Record</th>
                  <th className="px-4 py-3 font-medium">IP</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-black/5 hover:bg-black/[0.02]">
                    <td className="px-4 py-3 text-xs text-aurora-text/60">{new Date(row.timestamp).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      {row.user ? (
                        <>
                          <p className="font-medium">
                            {row.user.firstName} {row.user.lastName}
                          </p>
                          <p className="text-xs text-aurora-text/50">{row.user.email}</p>
                        </>
                      ) : (
                        <span className="text-aurora-text/40">Unknown user</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`aurora-badge ${ACTION_BADGE[row.action] ?? "border-black/20 text-aurora-text/70"}`}>
                        {titleCase(row.action)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span className="font-medium">{row.entityType}</span>
                      {row.entityId && <span className="ml-1 text-aurora-text/40">#{row.entityId.slice(0, 8)}</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-aurora-text/50">{row.ipAddress ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}

      <div className="flex items-center justify-between text-sm text-aurora-text/60">
        <span>
          {total === 0 ? "0 results" : `Showing ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total}`}
        </span>
        <div className="flex items-center gap-2">
          <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="rounded-lg p-1.5 hover:bg-black/10 disabled:opacity-30">
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
    </div>
  );
}
