import { useState } from "react";
import { Bell, HelpCircle, LogOut, ChevronDown, Menu } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useSupportBadge } from "@/hooks/useSupportBadge";
import { NotificationDrawer } from "@/components/Common/NotificationDrawer";
import { initials } from "@/lib/utils";

export function Navbar({ onOpenMobileNav }: { onOpenMobileNav?: () => void }) {
  const { user, logout } = useAuth();
  const { tenant } = useTenant();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const supportCount = useSupportBadge();

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-black/10 bg-black/[0.02] px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          onClick={onOpenMobileNav}
          className="rounded-lg p-2 text-aurora-text/60 transition hover:bg-black/10 hover:text-aurora-text md:hidden"
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>
        {!tenant && <div className="truncate text-sm font-medium text-aurora-text/60">Platform Administration</div>}
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <button
          onClick={() => setNotificationsOpen(true)}
          className="relative hidden rounded-lg p-2 text-aurora-text/60 transition hover:bg-black/10 hover:text-aurora-text sm:block"
          aria-label="Notifications"
        >
          <Bell size={18} />
          {supportCount > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-aurora-error px-1 text-[10px] font-bold text-white">
              {supportCount > 9 ? "9+" : supportCount}
            </span>
          )}
        </button>
        <button
          className="hidden rounded-lg p-2 text-aurora-text/60 transition hover:bg-black/10 hover:text-aurora-text sm:block"
          aria-label="Help"
        >
          <HelpCircle size={18} />
        </button>

        <div className="relative">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-2 rounded-xl px-2 py-1.5 transition hover:bg-black/10"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-aurora-accent text-xs font-bold">
              {initials(user?.firstName, user?.lastName)}
            </div>
            <span className="hidden text-sm font-medium sm:inline">{user?.firstName ?? user?.email}</span>
            <ChevronDown size={14} className="text-aurora-text/50" />
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="glass-card animate-fade-in absolute right-0 top-12 z-20 w-48 overflow-hidden !p-1">
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-aurora-error transition hover:bg-black/10"
                >
                  <LogOut size={16} />
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <NotificationDrawer open={notificationsOpen} onClose={() => setNotificationsOpen(false)} />
    </header>
  );
}
