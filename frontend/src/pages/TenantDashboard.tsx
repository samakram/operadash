import { LayoutGrid } from "lucide-react";
import { LoadingSpinner } from "@/components/Common/LoadingSpinner";
import { useTenant } from "@/hooks/useTenant";

// Deliberately empty for now — this used to just re-list every module (and
// every module's sub-features) a second time, duplicating the sidebar
// instead of showing anything of its own. Real dashboard content (whatever
// that ends up being — KPIs across modules, recent activity, etc.) comes
// later as its own deliberate decision, not a placeholder built from
// whatever data happened to be on hand.
export default function TenantDashboard() {
  const { tenant, isLoading } = useTenant();

  if (isLoading || !tenant) return <LoadingSpinner fullscreen />;

  return (
    <div className="animate-fade-in flex flex-col gap-6">
      <div>
        <h2>{tenant.name}</h2>
        <p className="mt-1 text-sm text-aurora-text/60">Welcome back</p>
      </div>

      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-aurora-border py-20 text-center text-aurora-text/40">
        <LayoutGrid size={22} className="opacity-50" />
        <p className="text-sm">Dashboard content coming soon</p>
        <p className="text-xs">Use the sidebar to get to a module</p>
      </div>
    </div>
  );
}
