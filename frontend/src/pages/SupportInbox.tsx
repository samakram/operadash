import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { MessageCircle, Plus, Send, CheckCircle2, RotateCcw, Building2 } from "lucide-react";
import { api, getApiErrorMessage } from "@/lib/api";
import { AuroraButton } from "@/components/Common/AuroraButton";
import { GlassInput, GlassTextarea } from "@/components/Common/GlassInput";
import { Modal } from "@/components/Common/Modal";
import { LoadingSpinner } from "@/components/Common/LoadingSpinner";
import { useToast } from "@/components/Common/Toast";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  senderId: string;
  senderRole: "super_admin" | "tenant_admin" | "staff";
  body: string;
  createdAt: string;
}

interface TicketListRow {
  id: string;
  subject: string;
  status: "open" | "resolved";
  updatedAt: string;
  tenant?: { name: string };
  messages: { body: string; createdAt: string }[];
}

interface TicketDetail {
  id: string;
  subject: string;
  status: "open" | "resolved";
  tenant?: { name: string };
  messages: Message[];
}

function isOwnSide(senderRole: Message["senderRole"], viewerIsSuperAdmin: boolean): boolean {
  return (senderRole === "super_admin") === viewerIsSuperAdmin;
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function SupportInbox() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { show } = useToast();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "super_admin";
  const basePath = isSuperAdmin ? "/admin/support" : "/app/support";

  const [tickets, setTickets] = useState<TicketListRow[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [filter, setFilter] = useState<"open" | "resolved" | "all">("open");

  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [isLoadingThread, setIsLoadingThread] = useState(false);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const loadList = useCallback(async () => {
    setIsLoadingList(true);
    try {
      const { data } = await api.get<TicketListRow[]>("/support/tickets", { params: filter === "all" ? {} : { status: filter } });
      setTickets(data);
    } catch (err) {
      show(getApiErrorMessage(err, "Failed to load support tickets"), "error");
    } finally {
      setIsLoadingList(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const loadThread = useCallback(async () => {
    if (!id) {
      setTicket(null);
      return;
    }
    setIsLoadingThread(true);
    try {
      const { data } = await api.get<TicketDetail>(`/support/tickets/${id}`);
      setTicket(data);
    } catch (err) {
      show(getApiErrorMessage(err, "Failed to load conversation"), "error");
    } finally {
      setIsLoadingThread(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    void loadThread();
  }, [loadThread]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [ticket?.messages.length]);

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || !id) return;
    setIsSending(true);
    try {
      await api.post(`/support/tickets/${id}/messages`, { body: draft });
      setDraft("");
      await Promise.all([loadThread(), loadList()]);
    } catch (err) {
      show(getApiErrorMessage(err, "Failed to send message"), "error");
    } finally {
      setIsSending(false);
    }
  };

  const toggleStatus = async () => {
    if (!ticket) return;
    try {
      await api.patch(`/support/tickets/${ticket.id}`, { status: ticket.status === "open" ? "resolved" : "open" });
      await Promise.all([loadThread(), loadList()]);
    } catch (err) {
      show(getApiErrorMessage(err, "Failed to update ticket"), "error");
    }
  };

  const handleCreate = async () => {
    setIsSaving(true);
    try {
      const { data } = await api.post<{ id: string }>("/support/tickets", { subject, message });
      setCreateOpen(false);
      setSubject("");
      setMessage("");
      await loadList();
      navigate(`${basePath}/${data.id}`);
    } catch (err) {
      show(getApiErrorMessage(err, "Failed to create ticket"), "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="animate-fade-in flex h-[calc(100vh-140px)] min-h-[420px] flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2>Support</h2>
          <p className="mt-0.5 text-sm text-aurora-text/60">{isSuperAdmin ? "Conversations with tenants" : "Message the OperaDash team"}</p>
        </div>
        {!isSuperAdmin && (
          <AuroraButton size="sm" icon={<Plus size={16} />} onClick={() => setCreateOpen(true)}>
            New ticket
          </AuroraButton>
        )}
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden rounded-xl border border-aurora-border bg-white">
        {/* Conversation list — narrow, its own scroll */}
        <div className="flex w-72 shrink-0 flex-col border-r border-aurora-border sm:w-80">
          <div className="flex shrink-0 gap-1 border-b border-aurora-border p-2">
            {(["open", "resolved", "all"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "flex-1 rounded-md px-2 py-1.5 text-xs font-semibold capitalize transition",
                  filter === f ? "bg-aurora-accent text-white" : "text-aurora-text/60 hover:bg-black/[0.04]",
                )}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {isLoadingList ? (
              <LoadingSpinner fullscreen />
            ) : tickets.length === 0 ? (
              <div className="p-6 text-center text-sm text-aurora-text/40">
                <MessageCircle className="mx-auto mb-2 opacity-40" size={22} />
                No {filter !== "all" ? filter : ""} tickets
              </div>
            ) : (
              tickets.map((t) => {
                const last = t.messages[0];
                const active = t.id === id;
                return (
                  <button
                    key={t.id}
                    onClick={() => navigate(`${basePath}/${t.id}`)}
                    className={cn(
                      "flex w-full flex-col gap-0.5 border-b border-black/[0.04] px-3 py-2.5 text-left transition",
                      active ? "bg-aurora-accent-soft" : "hover:bg-black/[0.03]",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn("truncate text-sm font-semibold", active ? "text-aurora-accent" : "text-aurora-text")}>
                        {isSuperAdmin && t.tenant ? t.tenant.name : t.subject}
                      </span>
                      <span className="shrink-0 text-[11px] text-aurora-text/40">{timeAgo(t.updatedAt)}</span>
                    </div>
                    {isSuperAdmin && <p className="truncate text-xs font-medium text-aurora-text/60">{t.subject}</p>}
                    <p className="truncate text-xs text-aurora-text/50">{last?.body ?? "No messages yet"}</p>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Thread */}
        <div className="flex min-w-0 flex-1 flex-col">
          {!id || !ticket ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-aurora-text/40">
              {isLoadingThread ? (
                <LoadingSpinner />
              ) : (
                <>
                  <MessageCircle size={32} className="opacity-30" />
                  <p className="text-sm">Select a conversation</p>
                </>
              )}
            </div>
          ) : (
            <>
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-aurora-border px-4 py-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-aurora-accent-soft text-aurora-accent">
                    <Building2 size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{isSuperAdmin && ticket.tenant ? ticket.tenant.name : ticket.subject}</p>
                    <p className="truncate text-xs text-aurora-text/50">{isSuperAdmin ? ticket.subject : "OperaDash Support"}</p>
                  </div>
                </div>
                <AuroraButton
                  size="sm"
                  variant="ghost"
                  icon={ticket.status === "open" ? <CheckCircle2 size={14} /> : <RotateCcw size={14} />}
                  onClick={toggleStatus}
                  className="shrink-0"
                >
                  {ticket.status === "open" ? "Resolve" : "Reopen"}
                </AuroraButton>
              </div>

              <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto bg-black/[0.015] p-4">
                {ticket.messages.map((m) => {
                  const own = isOwnSide(m.senderRole, isSuperAdmin);
                  return (
                    <div key={m.id} className={cn("flex", own ? "justify-end" : "justify-start")}>
                      <div
                        className={cn(
                          "max-w-[75%] rounded-2xl px-4 py-2 text-sm",
                          own ? "rounded-br-md bg-aurora-accent text-white" : "rounded-bl-md bg-black/[0.06] text-aurora-text",
                        )}
                      >
                        <p className="whitespace-pre-wrap break-words">{m.body}</p>
                        <p className={cn("mt-1 text-[10px]", own ? "text-white/70" : "text-aurora-text/40")}>
                          {new Date(m.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              <form onSubmit={handleSend} className="flex shrink-0 items-center gap-2 border-t border-aurora-border p-3">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="iMessage"
                  className="glass-input flex-1 px-4 py-2.5 text-sm placeholder:text-aurora-text/40"
                />
                <button
                  type="submit"
                  disabled={!draft.trim() || isSending}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-aurora-accent text-white transition disabled:opacity-40"
                >
                  <Send size={16} />
                </button>
              </form>
            </>
          )}
        </div>
      </div>

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
