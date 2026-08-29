import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Trash2 } from "lucide-react";
import { api, getApiErrorMessage } from "@/lib/api";
import { GlassCard } from "@/components/Common/GlassCard";
import { AuroraButton } from "@/components/Common/AuroraButton";
import { GlassSelect } from "@/components/Common/GlassInput";
import { Modal } from "@/components/Common/Modal";
import { LoadingSpinner } from "@/components/Common/LoadingSpinner";
import { useToast } from "@/components/Common/Toast";
import { Toggle } from "@/components/Common/Toggle";
import { formatCurrency, formatDate, initials, titleCase } from "@/lib/utils";
import type { ModuleName, PlanTier, Tenant } from "@/hooks/useTenant";

interface TenantUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  active: boolean;
  createdAt: string;
}

interface TenantDetailResponse extends Tenant {
  users: TenantUser[];
  createdAt: string;
}

const ALL_MODULES: ModuleName[] = ["hotel", "student", "patient", "restaurant"];
const PLAN_OPTIONS: { value: PlanTier; label: string }[] = [
  { value: "free", label: "Free" },
  { value: "starter", label: "Starter" },
  { value: "pro", label: "Pro" },
  { value: "enterprise", label: "Enterprise" },
];

export default function TenantDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { show } = useToast();
  const [tenant, setTenant] = useState<TenantDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const { data } = await api.get<TenantDetailResponse>(`/tenants/${id}`);
      setTenant(data);
    } catch (err) {
      show(getApiErrorMessage(err, "Failed to load tenant"), "error");
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleModule = async (m: ModuleName) => {
    if (!tenant) return;
    const modules = tenant.enabledModules.includes(m) ? tenant.enabledModules.filter((x) => x !== m) : [...tenant.enabledModules, m];
    try {
      await api.patch(`/tenants/${tenant.id}/modules`, { modules });
      show("Modules updated", "success");
      await load();
    } catch (err) {
      show(getApiErrorMessage(err, "Failed to update modules"), "error");
    }
  };

  const changePlan = async (plan: PlanTier) => {
    if (!tenant) return;
    try {
      await api.patch(`/tenants/${tenant.id}`, { plan });
      show("Plan updated", "success");
      await load();
    } catch (err) {
      show(getApiErrorMessage(err, "Failed to update plan"), "error");
    }
  };

  const handleDelete = async () => {
    if (!tenant) return;
    try {
      await api.delete(`/tenants/${tenant.id}`);
      show("Tenant deleted", "success");
      navigate("/admin/tenants");
    } catch (err) {
      show(getApiErrorMessage(err, "Failed to delete tenant"), "error");
    }
  };

  if (isLoading || !tenant) return <LoadingSpinner fullscreen />;

  return (
    <div className="animate-fade-in flex flex-col gap-5">
      <button onClick={() => navigate("/admin/tenants")} className="inline-flex w-fit items-center gap-1 text-sm text-aurora-text/60 hover:text-aurora-text">
        <ArrowLeft size={14} /> Back to tenants
      </button>

      <div className="flex items-center justify-between">
        <div>
          <h2>{tenant.name}</h2>
          <p className="mt-1 text-sm text-aurora-text/60">{tenant.subdomain}.operadash.com &middot; created {formatDate(tenant.createdAt)}</p>
        </div>
        <AuroraButton variant="danger" icon={<Trash2 size={16} />} onClick={() => setDeleteOpen(true)}>
          Delete tenant
        </AuroraButton>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <GlassCard className="flex flex-col gap-4">
          <h3>Plan &amp; billing</h3>
          <GlassSelect label="Plan" options={PLAN_OPTIONS} value={tenant.plan} onChange={(e) => changePlan(e.target.value as PlanTier)} />
          <p className="text-sm text-aurora-text/60">Monthly revenue: {formatCurrency(tenant.monthlyRevenue)}</p>
        </GlassCard>

        <GlassCard className="flex flex-col gap-3">
          <h3>Enabled modules</h3>
          {ALL_MODULES.map((m) => (
            <div key={m} className="rounded-lg px-2 py-1.5 hover:bg-black/5">
              <Toggle label={titleCase(m)} checked={tenant.enabledModules.includes(m)} onChange={() => toggleModule(m)} />
            </div>
          ))}
        </GlassCard>

        <GlassCard className="flex flex-col gap-2">
          <h3>Status</h3>
          <span className={`aurora-badge w-fit ${tenant.active ? "border-aurora-success/40 text-aurora-success" : "border-aurora-error/40 text-aurora-error"}`}>
            {tenant.active ? "Active" : "Disabled"}
          </span>
          <p className="text-sm text-aurora-text/60">{tenant.users.length} user{tenant.users.length === 1 ? "" : "s"}</p>
        </GlassCard>
      </div>

      <GlassCard padding="none">
        <div className="border-b border-black/10 px-6 py-4">
          <h3>Users</h3>
        </div>
        <div className="divide-y divide-black/5">
          {tenant.users.map((u) => (
            <div key={u.id} className="flex items-center justify-between px-6 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-aurora-accent text-xs font-bold">
                  {initials(u.firstName, u.lastName)}
                </div>
                <div>
                  <p className="text-sm font-medium">
                    {u.firstName} {u.lastName}
                  </p>
                  <p className="text-xs text-aurora-text/50">{u.email}</p>
                </div>
              </div>
              <span className="aurora-badge border-black/20">{titleCase(u.role)}</span>
            </div>
          ))}
        </div>
      </GlassCard>

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete tenant"
        size="sm"
        footer={
          <>
            <AuroraButton variant="ghost" onClick={() => setDeleteOpen(false)}>
              Cancel
            </AuroraButton>
            <AuroraButton variant="danger" onClick={handleDelete}>
              Delete permanently
            </AuroraButton>
          </>
        }
      >
        <p className="text-sm text-aurora-text/70">
          This permanently deletes <strong>{tenant.name}</strong> and all of its data. This cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
