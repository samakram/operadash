import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { MessageCircle, Plus, Building2 } from "lucide-react";
import { api, getApiErrorMessage } from "@/lib/api";
import { GlassCard } from "@/components/Common/GlassCard";
import { AuroraButton } from "@/components/Common/AuroraButton";
import { GlassInput, GlassTextarea } from "@/components/Common/GlassInput";
import { Modal } from "@/components/Common/Modal";
import { LoadingSpinner } from "@/components/Common/LoadingSpinner";
import { useToast } from "@/components/Common/Toast";
import { useAuth } from "@/hooks/useAuth";
import { formatDate } from "@/lib/utils";

interface TicketListRow {
  id: string;
  subject: string;
  status: "open" | "resolved";
  updatedAt: string;
  tenant?: { name: string };
  messages: { body: string; createdAt: string }[];
  _count: { messages: number };
}

export default function SupportPage() {
  const { show } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isSuperAdmin = user?.role === "super_admin";
  const basePath = isSuperAdmin ? "/admin/support" : "/app/support";

  const [tickets, setTickets] = useState<TicketListRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<"open" | "resolved" | "all">("open");
  const [createOpen, setCreateOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data } = await api.get<TicketListRow[]>("/support/tickets", {
        params: filter === "all" ? {} : { status: filter },
      });
      setTickets(data);
    } catch (err) {
      show(getApiErrorMessage(err, "Failed to load support tickets"), "error");
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load, location.key]);

  const handleCreate = async () => {
    setIsSaving(true);
    try {
      const { data } = await api.post<{ id: string }>("/support/tickets", { subject, message });
      setCreateOpen(false);
      setSubject("");
      setMessage("");
      navigate(`${basePath}/${data.id}`);
    } catch (err) {
      show(getApiErrorMessage(err, "Failed to create ticket"), "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="animate-fade-in flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2>Support</h2>
          <p className="mt-1 text-sm text-aurora-text/60">
            {isSuperAdmin ? "Conversations with tenants" : "Message the OperaDash team"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-aurora-border p-0.5">
            {(["open", "resolved", "all"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize transition ${
                  filter === f ? "bg-aurora-accent text-white" : "text-aurora-text/60 hover:bg-black/[0.04]"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          {!isSuperAdmin && (
            <AuroraButton size="sm" icon={<Plus size={16} />} onClick={() => setCreateOpen(true)}>
              New ticket
            </AuroraButton>
          )}
        </div>
      </div>

      {isLoading ? (
        <LoadingSpinner fullscreen />
      ) : tickets.length === 0 ? (
        <GlassCard className="py-16 text-center text-aurora-text/50">
          <MessageCircle className="mx-auto mb-2 opacity-40" size={28} />
          No {filter !== "all" ? filter : ""} tickets.
        </GlassCard>
      ) : (
        <div className="flex flex-col gap-2">
          {tickets.map((t) => {
            const last = t.messages[0];
            return (
              <Link key={t.id} to={`${basePath}/${t.id}`}>
                <GlassCard interactive padding="sm" className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-aurora-accent-soft text-aurora-accent">
                    <MessageCircle size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold">{t.subject}</p>
                      {t.status === "open" ? (
                        <span className="aurora-badge shrink-0 border-aurora-success/40 text-aurora-success">Open</span>
                      ) : (
                        <span className="aurora-badge shrink-0 border-black/20 text-aurora-text/50">Resolved</span>
                      )}
                    </div>
                    <p className="truncate text-xs text-aurora-text/50">
                      {isSuperAdmin && t.tenant && (
                        <span className="mr-1.5 inline-flex items-center gap-1 font-medium text-aurora-text/70">
                          <Building2 size={11} /> {t.tenant.name}
                        </span>
                      )}
                      {last?.body ?? "No messages yet"}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-aurora-text/40">{formatDate(t.updatedAt)}</span>
                </GlassCard>
              </Link>
            );
          })}
        </div>
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New support ticket"
        footer={
          <>
            <AuroraButton variant="ghost" onClick={() => setCreateOpen(false)}>
              Cancel
            </AuroraButton>
            <AuroraButton isLoading={isSaving} onClick={handleCreate} disabled={!subject.trim() || !message.trim()}>
              Send
            </AuroraButton>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <GlassInput label="Subject" required value={subject} onChange={(e) => setSubject(e.target.value)} />
          <GlassTextarea label="Message" required rows={4} value={message} onChange={(e) => setMessage(e.target.value)} />
        </div>
      </Modal>
    </div>
  );
}
