import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { LoadingSpinner } from "@/components/Common/LoadingSpinner";
import { useTenant } from "@/hooks/useTenant";
import { MODULE_META, MODULE_FEATURES } from "@/lib/moduleNav";

// Every individual feature link already lives in the sidebar's nested nav
// (see Sidebar.tsx) — this page is the module launcher, not a second copy of
// that list, so it only goes one level deep: pick a module, the sidebar
// handles the rest.
export default function TenantDashboard() {
  const { tenant, isLoading } = useTenant();

  if (isLoading || !tenant) return <LoadingSpinner fullscreen />;

  return (
    <div className="animate-fade-in flex flex-col gap-6">
      <div>
        <h2>{tenant.name}</h2>
        <p className="mt-1 text-sm text-aurora-text/60">Everything enabled for your account</p>
      </div>

      {tenant.enabledModules.length === 0 ? (
        <div className="rounded-xl border border-aurora-border bg-white py-16 text-center text-aurora-text/50">
          No modules are enabled for your account yet. Contact your platform administrator.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {tenant.enabledModules.map((moduleName) => {
            const meta = MODULE_META[moduleName];
            const featureCount = MODULE_FEATURES[moduleName].length;
            return (
              <Link
                key={moduleName}
                to={meta.to}
                className="group flex items-center gap-3 rounded-xl border border-aurora-border bg-white p-4 transition hover:border-aurora-accent/40 hover:shadow-glass"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-aurora-accent">
                  <meta.icon size={18} className="text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-aurora-ink group-hover:text-aurora-accent">{meta.label}</h3>
                  <p className="truncate text-xs text-aurora-text/50">
                    {meta.description} &middot; {featureCount} tools
                  </p>
                </div>
                <ChevronRight size={16} className="shrink-0 text-aurora-text/30 transition group-hover:translate-x-0.5 group-hover:text-aurora-accent" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
