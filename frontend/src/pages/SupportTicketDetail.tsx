import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Send, CheckCircle2, RotateCcw } from "lucide-react";
import { api, getApiErrorMessage } from "@/lib/api";
import { AuroraButton } from "@/components/Common/AuroraButton";
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

interface TicketDetail {
  id: string;
  subject: string;
  status: "open" | "resolved";
  tenant?: { name: string };
  messages: Message[];
}

function isOwnSide(senderRole: Message["senderRole"], viewerIsSuperAdmin: boolean): boolean {
  const senderIsSuperAdmin = senderRole === "super_admin";
  return senderIsSuperAdmin === viewerIsSuperAdmin;
}

export default function SupportTicketDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { show } = useToast();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "super_admin";
  const basePath = isSuperAdmin ? "/admin/support" : "/app/support";

  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const { data } = await api.get<TicketDetail>(`/support/tickets/${id}`);
      setTicket(data);
    } catch (err) {
      show(getApiErrorMessage(err, "Failed to load ticket"), "error");
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

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
      await load();
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
      await load();
    } catch (err) {
      show(getApiErrorMessage(err, "Failed to update ticket"), "error");
    }
  };

  if (isLoading || !ticket) return <LoadingSpinner fullscreen />;

  return (
    <div className="animate-fade-in flex h-full flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <button onClick={() => navigate(basePath)} className="inline-flex items-center gap-1 text-sm text-aurora-text/60 hover:text-aurora-text">
          <ArrowLeft size={14} /> Back
        </button>
        <AuroraButton
          size="sm"
          variant="ghost"
          icon={ticket.status === "open" ? <CheckCircle2 size={14} /> : <RotateCcw size={14} />}
          onClick={toggleStatus}
        >
          {ticket.status === "open" ? "Mark resolved" : "Reopen"}
        </AuroraButton>
      </div>

      <div>
        <h2>{ticket.subject}</h2>
        {isSuperAdmin && ticket.tenant && <p className="mt-0.5 text-sm text-aurora-text/60">{ticket.tenant.name}</p>}
      </div>

      <div className="flex flex-1 flex-col gap-2 overflow-y-auto rounded-xl border border-aurora-border bg-black/[0.015] p-4">
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

      <form onSubmit={handleSend} className="flex items-center gap-2">
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
    </div>
  );
}
