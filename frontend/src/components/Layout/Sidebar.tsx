import { NavLink } from "react-router-dom";
import {
  LayoutGrid,
  Building2,
  Blocks,
  BarChart3,
  Settings,
  Hotel,
  GraduationCap,
  Stethoscope,
  UtensilsCrossed,
  Users,
  MessageCircle,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
}

const MODULE_META: Record<string, { label: string; icon: LucideIcon; to: string }> = {
  hotel: { label: "Hotel", icon: Hotel, to: "/app/hotel" },
  student: { label: "Student", icon: GraduationCap, to: "/app/student" },
  patient: { label: "Patient", icon: Stethoscope, to: "/app/patient" },
  restaurant: { label: "Restaurant", icon: UtensilsCrossed, to: "/app/restaurant" },
};

function useNavItems(): NavItem[] {
  const { user } = useAuth();
  const { tenant } = useTenant();

  return user?.role === "super_admin"
    ? [
        { to: "/admin/tenants", label: "Tenants", icon: Building2 },
        { to: "/admin/modules", label: "Modules", icon: Blocks },
        { to: "/admin/analytics", label: "Analytics", icon: BarChart3 },
        { to: "/admin/support", label: "Support", icon: MessageCircle },
        { to: "/admin/settings", label: "Settings", icon: Settings },
      ]
    : [
        { to: "/app", label: "Dashboard", icon: LayoutGrid },
        ...(tenant?.enabledModules.map((m) => ({ to: MODULE_META[m].to, label: MODULE_META[m].label, icon: MODULE_META[m].icon })) ?? []),
        ...(user?.role === "tenant_admin" ? [{ to: "/app/staff", label: "Staff", icon: Users }] : []),
        { to: "/app/support", label: "Support", icon: MessageCircle },
      ];
}

function Brand() {
  return (
    <div className="mb-6 flex items-center gap-2 px-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-aurora-accent font-bold">O</div>
      <span className="text-lg font-bold tracking-tight">OperaDash</span>
    </div>
  );
}

function NavList({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === "/app"}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-aurora-text/70 transition-colors duration-150",
              "hover:bg-black/[0.04] hover:text-aurora-text",
              isActive && "bg-aurora-accent-soft text-aurora-accent hover:bg-aurora-accent-soft",
            )
          }
        >
          <item.icon size={18} />
          {item.label}
        </NavLink>
      ))}
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
      <aside className="hidden w-64 shrink-0 flex-col gap-1 border-r border-black/10 bg-black/[0.03] px-3 py-6 md:flex">
        <Brand />
        <NavList items={items} />
      </aside>

      {/* Mobile drawer — overlay + slide-in panel, only exists below md. */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="glass-modal-backdrop absolute inset-0 animate-fade-in" onClick={onCloseMobile} />
          <aside className="glass-card absolute inset-y-0 left-0 flex w-72 animate-slide-in flex-col gap-1 rounded-none rounded-r-2xl px-3 py-6">
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
