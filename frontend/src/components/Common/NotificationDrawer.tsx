import { useEffect, useState } from "react";
import { MessageCircle, Bell } from "lucide-react";
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

  // A small anchored dropdown next to the bell — not a full-height drawer —
  // matching the profile menu's own pattern (Navbar.tsx). The parent button
  // must sit inside a `relative` wrapper for this to position correctly.
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="glass-card animate-fade-in absolute right-0 top-12 z-50 flex max-h-[28rem] w-80 flex-col overflow-hidden !p-0">
        <div className="flex shrink-0 items-center gap-2 border-b border-black/10 px-4 py-3">
          <Bell size={15} />
          <span className="text-sm font-semibold text-aurora-ink">Notifications</span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-8 text-center text-sm text-aurora-text/40">
              <Bell className="opacity-30" size={24} />
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
                className="flex w-full items-start gap-2.5 border-b border-black/[0.04] px-4 py-3 text-left transition last:border-b-0 hover:bg-black/[0.03]"
              >
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-aurora-accent-soft text-aurora-accent">
                  <MessageCircle size={13} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{item.title}</p>
                  <p className="truncate text-xs text-aurora-text/50">{item.subtitle}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </>
  );
}
