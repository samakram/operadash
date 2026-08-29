import { useCallback, useEffect, useState } from "react";
import { Hotel, GraduationCap, Stethoscope, UtensilsCrossed, type LucideIcon } from "lucide-react";
import { api, getApiErrorMessage } from "@/lib/api";
import { GlassCard } from "@/components/Common/GlassCard";
import { LoadingSpinner } from "@/components/Common/LoadingSpinner";
import { useToast } from "@/components/Common/Toast";
import { formatDate } from "@/lib/utils";

interface ModuleInfo {
  id: string;
  name: "hotel" | "student" | "patient" | "restaurant";
  version: string;
  description: string | null;
  tenantsUsing: number;
  createdAt: string;
}

const MODULE_ICON: Record<string, LucideIcon> = { hotel: Hotel, student: GraduationCap, patient: Stethoscope, restaurant: UtensilsCrossed };

export default function ModulesPage() {
  const { show } = useToast();
  const [modules, setModules] = useState<ModuleInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data } = await api.get<ModuleInfo[]>("/modules");
      setModules(data);
    } catch (err) {
      show(getApiErrorMessage(err, "Failed to load modules"), "error");
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (isLoading) return <LoadingSpinner fullscreen />;

  return (
    <div className="animate-fade-in flex flex-col gap-5">
      <div>
        <h2>Modules</h2>
        <p className="mt-1 text-sm text-aurora-text/60">Platform modules available to tenants</p>
      </div>

      <div className="stagger-children grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
        {modules.map((module) => {
          const Icon = MODULE_ICON[module.name] ?? Hotel;
          return (
            <GlassCard key={module.id} padding="sm" className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-aurora-accent">
                    <Icon size={15} className="text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold capitalize">{module.name} CRM</p>
                    <p className="text-xs text-aurora-text/50">v{module.version}</p>
                  </div>
                </div>
                <span className="aurora-badge border-aurora-success/40 text-aurora-success">Active</span>
              </div>
              <p className="text-xs text-aurora-text/60">{module.description}</p>
              <div className="flex items-center justify-between border-t border-black/10 pt-2.5 text-xs text-aurora-text/50">
                <span>{module.tenantsUsing} tenant{module.tenantsUsing === 1 ? "" : "s"} using</span>
                <span>Updated {formatDate(module.createdAt)}</span>
              </div>
            </GlassCard>
          );
        })}
      </div>
    </div>
  );
}
