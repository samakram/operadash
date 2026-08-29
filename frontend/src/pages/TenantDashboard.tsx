import { Link } from "react-router-dom";
import { LoadingSpinner } from "@/components/Common/LoadingSpinner";
import { useTenant } from "@/hooks/useTenant";
import { MODULE_META, MODULE_FEATURES } from "@/lib/moduleNav";

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
        <div className="flex flex-col gap-6">
          {tenant.enabledModules.map((moduleName) => {
            const meta = MODULE_META[moduleName];
            const features = MODULE_FEATURES[moduleName];
            return (
              <div key={moduleName} className="flex flex-col gap-3">
                <Link to={meta.to} className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-aurora-accent">
                    <meta.icon size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold hover:text-aurora-accent">{meta.label}</h3>
                    <p className="text-xs text-aurora-text/50">{meta.description}</p>
                  </div>
                </Link>

                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {features.map((feature) => (
                    <Link
                      key={feature.to}
                      to={`${meta.to}/${feature.to}`}
                      className="flex flex-col items-start gap-2 rounded-xl border border-aurora-border bg-white p-3 transition hover:border-aurora-accent/40 hover:shadow-glass-hover"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-aurora-accent-soft text-aurora-accent">
                        <feature.icon size={15} />
                      </div>
                      <span className="text-sm font-medium">{feature.label}</span>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
