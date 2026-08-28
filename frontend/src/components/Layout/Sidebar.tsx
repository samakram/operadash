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

export function Sidebar() {
  const { user } = useAuth();
  const { tenant } = useTenant();

  const items: NavItem[] =
    user?.role === "super_admin"
      ? [
          { to: "/admin/tenants", label: "Tenants", icon: Building2 },
          { to: "/admin/modules", label: "Modules", icon: Blocks },
          { to: "/admin/analytics", label: "Analytics", icon: BarChart3 },
          { to: "/admin/settings", label: "Settings", icon: Settings },
        ]
      : [
          { to: "/app", label: "Dashboard", icon: LayoutGrid },
          ...(tenant?.enabledModules.map((m) => ({ to: MODULE_META[m].to, label: MODULE_META[m].label, icon: MODULE_META[m].icon })) ?? []),
          ...(user?.role === "tenant_admin" ? [{ to: "/app/staff", label: "Staff", icon: Users }] : []),
        ];

  return (
    <aside className="hidden w-64 shrink-0 flex-col gap-1 border-r border-white/10 bg-white/[0.03] px-3 py-6 md:flex">
      <div className="mb-6 flex items-center gap-2 px-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-aurora-gradient font-bold">O</div>
        <span className="text-lg font-bold tracking-tight">OperaDash</span>
      </div>
      <nav className="flex flex-col gap-1">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/app"}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-aurora-text/70 transition duration-300",
                "hover:bg-white/10 hover:text-aurora-text",
                isActive && "bg-white/10 text-aurora-text shadow-glass",
              )
            }
          >
            <item.icon size={18} />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
