import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, MessageCircle, Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { LoadingSpinner } from "@/components/Common/LoadingSpinner";

/**
 * One notification entry, typed so future sources (billing, system alerts, etc.)
 * can be appended alongside support tickets without reshaping this component.
 */
interface NotificationItem {
  id: string;
  type: "support_ticket";
  title: string;
  subtitle: string;
  updatedAt: string;
  to: string;
}

interface TicketRow {
  id: string;
  subject: string;
  updatedAt: string;
  tenant?: { name: string };
  messages: { body: string }[];
}

interface NotificationDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function NotificationDrawer({ open, onClose }: NotificationDrawerProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isSuperAdmin = user?.role === "super_admin";
  const basePath = isSuperAdmin ? "/admin/support" : "/app/support";

  const [items, setItems] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setIsLoading(true);
    api
      .get<TicketRow[]>("/support/tickets", { params: { status: "open" } })
      .then(({ data }) =>
        setItems(
          data.map((t) => ({
            id: t.id,
            type: "support_ticket",
            title: isSuperAdmin && t.tenant ? t.tenant.name : t.subject,
            subtitle: isSuperAdmin ? t.subject : (t.messages[0]?.body ?? "New message"),
            updatedAt: t.updatedAt,
            to: `${basePath}/${t.id}`,
          })),
        ),
      )
      .catch(() => setItems([]))
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div className="glass-modal-backdrop absolute inset-0 animate-fade-in" onClick={onClose} />
      <aside className="glass-card absolute inset-y-0 right-0 flex w-full max-w-sm animate-slide-in flex-col rounded-none rounded-l-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-black/10 px-5 py-4">
          <h3 className="flex items-center gap-2">
            <Bell size={17} /> Notifications
          </h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-aurora-text/60 transition hover:bg-black/10 hover:text-aurora-text" aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {isLoading ? (
            <LoadingSpinner fullscreen />
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-10 text-center text-sm text-aurora-text/40">
              <Bell className="opacity-30" size={28} />
              You're all caught up
            </div>
          ) : (
            items.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  onClose();
                  navigate(item.to);
                }}
                className="flex w-full items-start gap-3 border-b border-black/[0.04] px-5 py-3.5 text-left transition hover:bg-black/[0.03]"
              >
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-aurora-accent-soft text-aurora-accent">
                  <MessageCircle size={15} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{item.title}</p>
                  <p className="truncate text-xs text-aurora-text/50">{item.subtitle}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </aside>
    </div>,
    document.body,
  );
}
