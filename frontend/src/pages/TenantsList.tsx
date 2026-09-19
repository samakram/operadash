import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Building2, Users as UsersIcon, ExternalLink, Power, LogIn } from "lucide-react";
import { api, getApiErrorMessage } from "@/lib/api";
import { GlassCard } from "@/components/Common/GlassCard";
import { AuroraButton } from "@/components/Common/AuroraButton";
import { GlassInput, GlassSelect } from "@/components/Common/GlassInput";
import { Modal } from "@/components/Common/Modal";
import { Table, type Column } from "@/components/Common/Table";
import { useToast } from "@/components/Common/Toast";
import { Toggle } from "@/components/Common/Toggle";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency, splitFullName, titleCase } from "@/lib/utils";
import type { ModuleName, PlanTier, Tenant } from "@/hooks/useTenant";

interface TenantRow extends Tenant, Record<string, unknown> {
  _count: { users: number };
  createdAt: string;
}

interface PaginatedTenants {
  data: TenantRow[];
  total: number;
}

const MODULE_OPTIONS: { value: ModuleName; label: string }[] = [
  { value: "hotel", label: "Hotel" },
  { value: "student", label: "Student" },
  { value: "patient", label: "Patient" },
  { value: "restaurant", label: "Restaurant" },
];

const PLAN_OPTIONS: { value: PlanTier; label: string }[] = [
  { value: "free", label: "Free" },
  { value: "starter", label: "Starter" },
  { value: "pro", label: "Pro" },
  { value: "enterprise", label: "Enterprise" },
];

const tenantColumns: Column<TenantRow>[] = [
  {
    key: "name",
    header: "Tenant",
    render: (t) => (
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-aurora-accent">
          <Building2 size={14} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-aurora-ink">{t.name}</p>
          <p className="truncate text-[11px] text-aurora-text/45">{t.subdomain}.operadash.com</p>
        </div>
      </div>
    ),
  },
  { key: "plan", header: "Plan", render: (t) => <span className="aurora-badge border-aurora-accent/40 text-aurora-accent">{titleCase(t.plan)}</span> },
  {
    key: "enabledModules",
    header: "Modules",
    render: (t) =>
      t.enabledModules.length === 0 ? (
        <span className="text-xs text-aurora-text/40">None</span>
      ) : (
        <div className="flex flex-wrap gap-1">
          {t.enabledModules.map((m) => (
            <span key={m} className="aurora-badge !px-1.5 !py-0 border-aurora-blue/40 text-aurora-blue">
              {titleCase(m)}
            </span>
          ))}
        </div>
      ),
  },
  {
    key: "users",
    header: "Users",
    render: (t) => (
      <span className="inline-flex items-center gap-1 text-aurora-text/70">
        <UsersIcon size={13} /> {t._count.users}
      </span>
    ),
  },
  { key: "monthlyRevenue", header: "Revenue", render: (t) => formatCurrency(t.monthlyRevenue) },
  {
    key: "active",
    header: "Status",
    render: (t) => (
      <span className={`aurora-badge ${t.active ? "border-aurora-success/40 text-aurora-success" : "border-aurora-error/40 text-aurora-error"}`}>
        {t.active ? "Active" : "Disabled"}
      </span>
    ),
  },
];

const emptyForm = {
  name: "",
  subdomain: "",
  plan: "starter" as PlanTier,
  adminEmail: "",
  adminName: "",
  enabledModules: [] as ModuleName[],
};

export default function TenantsList() {
  const { show } = useToast();
  const { impersonateTenant } = useAuth();
  const navigate = useNavigate();
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [createdCreds, setCreatedCreds] = useState<{ email: string; password: string } | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data } = await api.get<PaginatedTenants>("/tenants", { params: { pageSize: 100 } });
      setTenants(data.data);
      setTotal(data.total);
    } catch (err) {
      show(getApiErrorMessage(err, "Failed to load tenants"), "error");
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleModule = (m: ModuleName) => {
    setForm((prev) => ({
      ...prev,
      enabledModules: prev.enabledModules.includes(m) ? prev.enabledModules.filter((x) => x !== m) : [...prev.enabledModules, m],
    }));
  };

  const handleCreate = async () => {
    setIsSaving(true);
    try {
      const { firstName, lastName } = splitFullName(form.adminName);
      const { name, subdomain, plan, adminEmail, enabledModules } = form;
      const { data } = await api.post("/tenants", {
        name,
        subdomain,
        plan,
        adminEmail,
        enabledModules,
        adminFirstName: firstName,
        adminLastName: lastName,
      });
      show(`Tenant "${form.name}" created`, "success");
      setCreatedCreds({ email: form.adminEmail, password: data.tempPassword });
      setForm(emptyForm);
      await load();
    } catch (err) {
      show(getApiErrorMessage(err, "Failed to create tenant"), "error");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleActive = async (tenant: TenantRow) => {
    try {
      await api.patch(`/tenants/${tenant.id}`, { active: !tenant.active });
      show(tenant.active ? "Tenant disabled" : "Tenant enabled", "success");
      await load();
    } catch (err) {
      show(getApiErrorMessage(err, "Failed to update tenant"), "error");
    }
  };

  const handleImpersonate = async (tenant: TenantRow) => {
    try {
      await impersonateTenant(tenant.id);
      navigate("/app");
    } catch (err) {
      show(getApiErrorMessage(err, "Failed to sign in as this tenant"), "error");
    }
  };

  return (
    <div className="animate-fade-in flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h2>Tenants</h2>
          <p className="mt-1 text-sm text-aurora-text/60">{total} tenant{total === 1 ? "" : "s"} on the platform</p>
        </div>
        <AuroraButton icon={<Plus size={16} />} onClick={() => setCreateOpen(true)}>
          Add Tenant
        </AuroraButton>
      </div>

      {!isLoading && tenants.length === 0 ? (
        <GlassCard className="py-16 text-center text-aurora-text/50">No tenants yet. Create your first one.</GlassCard>
      ) : (
        <Table<TenantRow>
          keyField="id"
          isLoading={isLoading}
          columns={tenantColumns}
          data={tenants}
          actions={(tenant) => (
            <div className="flex items-center justify-end gap-1">
              <Link to={`/admin/tenants/${tenant.id}`} title="Manage">
                <button className="rounded-lg p-1.5 text-aurora-text/60 transition hover:bg-black/10 hover:text-aurora-accent">
                  <ExternalLink size={15} />
                </button>
              </Link>
              <button
                onClick={() => handleImpersonate(tenant)}
                title="Sign in as this tenant's admin"
                className="rounded-lg p-1.5 text-aurora-text/60 transition hover:bg-black/10 hover:text-aurora-accent"
              >
                <LogIn size={15} />
              </button>
              <button
                onClick={() => toggleActive(tenant)}
                title={tenant.active ? "Disable" : "Enable"}
                className="rounded-lg p-1.5 text-aurora-text/60 transition hover:bg-black/10 hover:text-aurora-error"
              >
                <Power size={15} />
              </button>
            </div>
          )}
        />
      )}

      <Modal
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
          setCreatedCreds(null);
        }}
        title="Add Tenant"
        footer={
          !createdCreds && (
            <>
              <AuroraButton variant="ghost" onClick={() => setCreateOpen(false)}>
                Cancel
              </AuroraButton>
              <AuroraButton isLoading={isSaving} onClick={handleCreate}>
                Create tenant
              </AuroraButton>
            </>
          )
        }
      >
        {createdCreds ? (
          <div className="flex flex-col gap-3 text-sm">
            <p className="text-aurora-success">Tenant created! Share these temporary credentials with the admin:</p>
            <GlassCard padding="sm" className="font-mono text-xs">
              <p>Email: {createdCreds.email}</p>
              <p>Temp password: {createdCreds.password}</p>
            </GlassCard>
            <AuroraButton
              onClick={() => {
                setCreateOpen(false);
                setCreatedCreds(null);
              }}
            >
              Done
            </AuroraButton>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <GlassInput label="Tenant name" required value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
            <GlassInput
              label="Subdomain"
              required
              placeholder="acme-hotel"
              value={form.subdomain}
              onChange={(e) => setForm((p) => ({ ...p, subdomain: e.target.value.toLowerCase() }))}
            />
            <GlassSelect
              label="Plan"
              options={PLAN_OPTIONS}
              value={form.plan}
              onChange={(e) => setForm((p) => ({ ...p, plan: e.target.value as PlanTier }))}
            />
            <div />
            <GlassInput
              label="Admin name"
              required
              placeholder="Ada Admin"
              value={form.adminName}
              onChange={(e) => setForm((p) => ({ ...p, adminName: e.target.value }))}
            />
            <GlassInput
              label="Admin email"
              type="email"
              required
              value={form.adminEmail}
              onChange={(e) => setForm((p) => ({ ...p, adminEmail: e.target.value }))}
            />
            <div className="sm:col-span-2">
              <p className="mb-2 text-sm font-medium text-aurora-text/90">Enabled modules</p>
              <div className="flex flex-wrap gap-4">
                {MODULE_OPTIONS.map((opt) => (
                  <div key={opt.value} className="flex items-center gap-2 text-sm">
                    <Toggle size="sm" checked={form.enabledModules.includes(opt.value)} onChange={() => toggleModule(opt.value)} label={opt.label} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
