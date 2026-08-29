import { NavLink, useLocation } from "react-router-dom";
import { LayoutGrid, Building2, Blocks, BarChart3, Settings, Users, MessageCircle, X, ScrollText, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useSupportBadge } from "@/hooks/useSupportBadge";
import { MODULE_META, MODULE_FEATURES } from "@/lib/moduleNav";
import type { ModuleName } from "@/hooks/useTenant";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
  /** Set on tenant-module items so NavList can show that module's features nested underneath when active. */
  moduleKey?: ModuleName;
}

function useNavItems(): NavItem[] {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const supportBadge = useSupportBadge();

  return user?.role === "super_admin"
    ? [
        { to: "/admin/tenants", label: "Tenants", icon: Building2 },
        { to: "/admin/modules", label: "Modules", icon: Blocks },
        { to: "/admin/analytics", label: "Analytics", icon: BarChart3 },
        { to: "/admin/support", label: "Support", icon: MessageCircle, badge: supportBadge },
        { to: "/admin/settings", label: "Settings", icon: Settings },
      ]
    : [
        { to: "/app", label: "Dashboard", icon: LayoutGrid },
        ...(tenant?.enabledModules.map((m) => ({ to: MODULE_META[m].to, label: MODULE_META[m].label, icon: MODULE_META[m].icon, moduleKey: m })) ?? []),
        ...(user?.role === "tenant_admin"
          ? [
              { to: "/app/staff", label: "Staff", icon: Users },
              { to: "/app/audit-log", label: "Audit Log", icon: ScrollText },
            ]
          : []),
        { to: "/app/support", label: "Support", icon: MessageCircle, badge: supportBadge },
      ];
}

function Brand() {
  const { tenant } = useTenant();

  if (tenant) {
    return (
      <div className="mb-6 flex items-center gap-2 px-3">
        {tenant.logoUrl ? (
          <img src={tenant.logoUrl} alt="" className="h-9 w-9 shrink-0 rounded-xl border border-aurora-border object-cover" />
        ) : (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-aurora-accent font-bold text-white">
            {tenant.name.charAt(0).toUpperCase()}
          </div>
        )}
        <span className="truncate text-lg font-bold tracking-tight">{tenant.name}</span>
      </div>
    );
  }

  return (
    <div className="mb-6 flex items-center gap-2 px-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-aurora-accent font-bold text-white">O</div>
      <span className="text-lg font-bold tracking-tight">OperaDash</span>
    </div>
  );
}

function NavList({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const location = useLocation();

  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const isModuleActive = Boolean(item.moduleKey) && location.pathname.startsWith(item.to);
        return (
          <div key={item.to}>
            <NavLink
              to={item.to}
              end={item.to === "/app"}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-aurora-text/70 transition-colors duration-150",
                  "hover:bg-black/[0.04] hover:text-aurora-text",
                  (isActive || isModuleActive) && "bg-aurora-accent-soft text-aurora-accent hover:bg-aurora-accent-soft",
                )
              }
            >
              <item.icon size={18} />
              <span className="flex-1">{item.label}</span>
              {Boolean(item.badge) && (
                <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-aurora-error px-1.5 text-[11px] font-bold text-white">
                  {item.badge}
                </span>
              )}
            </NavLink>
            {isModuleActive && item.moduleKey && (
              <div className="ml-4 mt-1 flex flex-col gap-0.5 border-l border-aurora-border pl-3">
                {MODULE_FEATURES[item.moduleKey].map((feature) => (
                  <NavLink
                    key={feature.to}
                    to={`${item.to}/${feature.to}`}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium text-aurora-text/60 transition-colors duration-150",
                        "hover:bg-black/[0.04] hover:text-aurora-text",
                        isActive && "bg-aurora-accent-soft text-aurora-accent",
                      )
                    }
                  >
                    <feature.icon size={14} />
                    {feature.label}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

interface SidebarProps {
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export function Sidebar({ mobileOpen = false, onCloseMobile }: SidebarProps) {
  const items = useNavItems();

  return (
    <>
      {/* Desktop rail — always visible at md+, never rendered below it. */}
      <aside className="hidden w-64 shrink-0 flex-col gap-1 overflow-y-auto border-r border-black/10 bg-black/[0.03] px-3 py-6 md:flex">
        <Brand />
        <NavList items={items} />
      </aside>

      {/* Mobile drawer — overlay + slide-in panel, only exists below md. */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="glass-modal-backdrop absolute inset-0 animate-fade-in" onClick={onCloseMobile} />
          <aside className="glass-card absolute inset-y-0 left-0 flex w-72 animate-slide-in flex-col gap-1 overflow-y-auto rounded-none rounded-r-2xl px-3 py-6">
            <div className="mb-2 flex items-center justify-between px-1">
              <Brand />
              <button onClick={onCloseMobile} className="rounded-lg p-1.5 text-aurora-text/60 hover:bg-black/5" aria-label="Close menu">
                <X size={20} />
              </button>
            </div>
            <NavList items={items} onNavigate={onCloseMobile} />
          </aside>
        </div>
      )}
    </>
  );
}
