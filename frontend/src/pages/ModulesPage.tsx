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

      <div className="stagger-children grid grid-cols-1 gap-4 md:grid-cols-2">
        {modules.map((module) => {
          const Icon = MODULE_ICON[module.name] ?? Hotel;
          return (
            <GlassCard key={module.id} className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-aurora-gradient">
                    <Icon size={18} />
                  </div>
                  <div>
                    <p className="font-semibold capitalize">{module.name} CRM</p>
                    <p className="text-xs text-aurora-text/50">v{module.version}</p>
                  </div>
                </div>
                <span className="aurora-badge border-aurora-success/40 text-aurora-success">Active</span>
              </div>
              <p className="text-sm text-aurora-text/60">{module.description}</p>
              <div className="flex items-center justify-between border-t border-black/10 pt-3 text-sm text-aurora-text/50">
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
