import { Link } from "react-router-dom";
import { ArrowRight, Hotel, GraduationCap, Stethoscope, UtensilsCrossed, type LucideIcon } from "lucide-react";
import { GlassCard } from "@/components/Common/GlassCard";
import { useAuth } from "@/hooks/useAuth";
import { useTenant, type ModuleName } from "@/hooks/useTenant";
import { LoadingSpinner } from "@/components/Common/LoadingSpinner";

const MODULE_META: Record<ModuleName, { label: string; icon: LucideIcon; to: string; description: string }> = {
  hotel: { label: "Hotel CRM", icon: Hotel, to: "/app/hotel", description: "Guests, rooms, reservations, and housekeeping." },
  student: { label: "Student CRM", icon: GraduationCap, to: "/app/student", description: "Classes, attendance, grades, and tuition." },
  patient: { label: "Patient CRM", icon: Stethoscope, to: "/app/patient", description: "Appointments, records, prescriptions, and billing." },
  restaurant: { label: "Restaurant CRM", icon: UtensilsCrossed, to: "/app/restaurant", description: "Orders, menu, staff, and inventory." },
};

export default function TenantDashboard() {
  const { user } = useAuth();
  const { tenant, isLoading } = useTenant();

  if (isLoading || !tenant) return <LoadingSpinner fullscreen />;

  return (
    <div className="animate-fade-in flex flex-col gap-6">
      <div>
        <h2>
          Welcome back{user?.firstName ? `, ${user.firstName}` : ""}
        </h2>
        <p className="mt-1 text-sm text-aurora-text/60">Here's what's enabled for {tenant.name}</p>
      </div>

      {tenant.enabledModules.length === 0 ? (
        <GlassCard className="py-16 text-center text-aurora-text/50">
          No modules are enabled for your account yet. Contact your platform administrator.
        </GlassCard>
      ) : (
        <div className="stagger-children grid grid-cols-1 gap-4 md:grid-cols-2">
          {tenant.enabledModules.map((moduleName) => {
            const meta = MODULE_META[moduleName];
            return (
              <Link key={moduleName} to={meta.to}>
                <GlassCard interactive className="flex h-full items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-aurora-gradient">
                    <meta.icon size={22} />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold">{meta.label}</p>
                    <p className="text-sm text-aurora-text/60">{meta.description}</p>
                  </div>
                  <ArrowRight size={18} className="text-aurora-text/40" />
                </GlassCard>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
