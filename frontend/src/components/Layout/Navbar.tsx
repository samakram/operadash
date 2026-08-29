import { useEffect, useState } from "react";
import { Bell, HelpCircle, LogOut, ChevronDown, Menu, Building2, LogIn } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api, getApiErrorMessage } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useSupportBadge } from "@/hooks/useSupportBadge";
import { useToast } from "@/components/Common/Toast";
import { initials } from "@/lib/utils";

interface TenantOption {
  id: string;
  name: string;
  subdomain: string;
  active: boolean;
}

function TenantSwitcher() {
  const { impersonateTenant } = useAuth();
  const { show } = useToast();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!open || tenants.length > 0) return;
    setIsLoading(true);
    api
      .get<{ data: TenantOption[] }>("/tenants", { params: { pageSize: 100 } })
      .then(({ data }) => setTenants(data.data))
      .catch(() => show("Failed to load tenants", "error"))
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handlePick = async (tenantId: string) => {
    try {
      await impersonateTenant(tenantId);
      setOpen(false);
      navigate("/app");
    } catch (err) {
      show(getApiErrorMessage(err, "Failed to sign in as this tenant"), "error");
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg border border-aurora-border px-3 py-1.5 text-sm font-medium text-aurora-text/70 transition hover:bg-black/[0.03]"
      >
        <Building2 size={14} />
        <span className="hidden sm:inline">Jump to tenant</span>
        <ChevronDown size={14} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="glass-card animate-fade-in absolute right-0 top-11 z-20 w-64 overflow-hidden !p-1">
            <div className="max-h-80 overflow-y-auto">
              {isLoading ? (
                <p className="px-3 py-3 text-sm text-aurora-text/50">Loading…</p>
              ) : tenants.length === 0 ? (
                <p className="px-3 py-3 text-sm text-aurora-text/50">No tenants yet</p>
              ) : (
                tenants.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => handlePick(t.id)}
                    className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-black/[0.04]"
                  >
                    <span className="truncate">
                      <span className="font-medium">{t.name}</span>
                      <span className="ml-1.5 text-xs text-aurora-text/40">{t.subdomain}</span>
                    </span>
                    <LogIn size={14} className="shrink-0 text-aurora-text/40" />
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function Navbar({ onOpenMobileNav }: { onOpenMobileNav?: () => void }) {
  const { user, logout } = useAuth();
  const { tenant } = useTenant();
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const supportCount = useSupportBadge();
  const supportPath = user?.role === "super_admin" ? "/admin/support" : "/app/support";

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
        <div className="truncate text-sm font-medium text-aurora-text/60">{tenant ? tenant.name : "Platform Administration"}</div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {user?.role === "super_admin" && <TenantSwitcher />}
        <button
          onClick={() => navigate(supportPath)}
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
            <div className="glass-card animate-fade-in absolute right-0 top-12 w-48 overflow-hidden !p-1">
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-aurora-error transition hover:bg-black/10"
              >
                <LogOut size={16} />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
