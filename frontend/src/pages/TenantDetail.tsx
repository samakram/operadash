import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Trash2, LogIn, UserPlus, KeyRound, X, Pencil, Building2, ScrollText, Receipt } from "lucide-react";
import { api, getApiErrorMessage } from "@/lib/api";
import { GlassCard } from "@/components/Common/GlassCard";
import { AuroraButton } from "@/components/Common/AuroraButton";
import { GlassInput, GlassSelect } from "@/components/Common/GlassInput";
import { Modal } from "@/components/Common/Modal";
import { LoadingSpinner } from "@/components/Common/LoadingSpinner";
import { useToast } from "@/components/Common/Toast";
import { Toggle } from "@/components/Common/Toggle";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency, formatDate, initials, splitFullName, titleCase } from "@/lib/utils";
import { getInvoiceSettings, type ModuleName, type PlanTier, type Tenant } from "@/hooks/useTenant";

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

interface FeatureFlagRow {
  moduleName: ModuleName;
  featureName: string;
  label: string;
  enabled: boolean;
}

const ALL_MODULES: ModuleName[] = ["hotel", "student", "patient", "restaurant"];
const PLAN_OPTIONS: { value: PlanTier; label: string }[] = [
  { value: "free", label: "Free" },
  { value: "starter", label: "Starter" },
  { value: "pro", label: "Pro" },
  { value: "enterprise", label: "Enterprise" },
];
const USER_ROLE_OPTIONS = [
  { value: "tenant_admin", label: "Admin" },
  { value: "staff", label: "Staff" },
];

const emptyUserForm = { email: "", name: "", role: "tenant_admin" as "tenant_admin" | "staff" };

function randomPassword(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
}

export default function TenantDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { show } = useToast();
  const { impersonateTenant } = useAuth();
  const [tenant, setTenant] = useState<TenantDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [features, setFeatures] = useState<FeatureFlagRow[]>([]);

  const [addUserOpen, setAddUserOpen] = useState(false);
  const [userForm, setUserForm] = useState(emptyUserForm);
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [newUserCreds, setNewUserCreds] = useState<{ email: string; password: string } | null>(null);

  const [passwordTarget, setPasswordTarget] = useState<TenantUser | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  const [deleteUserTarget, setDeleteUserTarget] = useState<TenantUser | null>(null);

  const [logoModalOpen, setLogoModalOpen] = useState(false);
  const [logoUrlInput, setLogoUrlInput] = useState("");
  const [isSavingLogo, setIsSavingLogo] = useState(false);

  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState({ companyName: "", address: "", taxId: "" });
  const [isSavingInvoice, setIsSavingInvoice] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const [{ data }, { data: featureData }] = await Promise.all([
        api.get<TenantDetailResponse>(`/tenants/${id}`),
        api.get<FeatureFlagRow[]>(`/tenants/${id}/features`),
      ]);
      setTenant(data);
      setFeatures(featureData);
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

  const toggleFeature = async (row: FeatureFlagRow) => {
    if (!tenant) return;
    try {
      const { data } = await api.patch<FeatureFlagRow[]>(`/tenants/${tenant.id}/features`, {
        moduleName: row.moduleName,
        featureName: row.featureName,
        enabled: !row.enabled,
      });
      setFeatures(data);
    } catch (err) {
      show(getApiErrorMessage(err, "Failed to update feature"), "error");
    }
  };

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

  const handleImpersonate = async () => {
    if (!tenant) return;
    try {
      await impersonateTenant(tenant.id);
      navigate("/app");
    } catch (err) {
      show(getApiErrorMessage(err, "Failed to sign in as this tenant"), "error");
    }
  };

  const openAddUser = () => {
    setUserForm(emptyUserForm);
    setNewUserCreds(null);
    setAddUserOpen(true);
  };

  const handleAddUser = async () => {
    if (!tenant) return;
    setIsSavingUser(true);
    try {
      const { firstName, lastName } = splitFullName(userForm.name);
      const { data } = await api.post("/users", { email: userForm.email, role: userForm.role, firstName, lastName, tenantId: tenant.id });
      setNewUserCreds({ email: userForm.email, password: data.tempPassword });
      await load();
    } catch (err) {
      show(getApiErrorMessage(err, "Failed to add user"), "error");
    } finally {
      setIsSavingUser(false);
    }
  };

  const openResetPassword = (u: TenantUser) => {
    setPasswordTarget(u);
    setNewPassword(randomPassword());
  };

  const handleResetPassword = async () => {
    if (!passwordTarget) return;
    setIsSavingPassword(true);
    try {
      await api.post(`/users/${passwordTarget.id}/password`, { newPassword });
      show(`Password updated for ${passwordTarget.email}`, "success");
    } catch (err) {
      show(getApiErrorMessage(err, "Failed to update password"), "error");
    } finally {
      setIsSavingPassword(false);
    }
  };

  const openLogoModal = () => {
    setLogoUrlInput(tenant?.logoUrl ?? "");
    setLogoModalOpen(true);
  };

  const handleSaveLogo = async () => {
    if (!tenant) return;
    setIsSavingLogo(true);
    try {
      await api.patch(`/tenants/${tenant.id}`, { logoUrl: logoUrlInput || null });
      show("Logo updated", "success");
      setLogoModalOpen(false);
      await load();
    } catch (err) {
      show(getApiErrorMessage(err, "Failed to update logo"), "error");
    } finally {
      setIsSavingLogo(false);
    }
  };

  const openInvoiceModal = () => {
    const invoice = getInvoiceSettings(tenant);
    setInvoiceForm({ companyName: invoice.companyName ?? "", address: invoice.address ?? "", taxId: invoice.taxId ?? "" });
    setInvoiceModalOpen(true);
  };

  const handleSaveInvoiceSettings = async () => {
    if (!tenant) return;
    setIsSavingInvoice(true);
    try {
      await api.patch(`/tenants/${tenant.id}`, { settings: { ...tenant.settings, invoice: invoiceForm } });
      show("Invoicing details updated", "success");
      setInvoiceModalOpen(false);
      await load();
    } catch (err) {
      show(getApiErrorMessage(err, "Failed to update invoicing details"), "error");
    } finally {
      setIsSavingInvoice(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteUserTarget) return;
    try {
      await api.delete(`/users/${deleteUserTarget.id}`);
      show("User removed", "success");
      setDeleteUserTarget(null);
      await load();
    } catch (err) {
      show(getApiErrorMessage(err, "Failed to remove user"), "error");
    }
  };

  if (isLoading || !tenant) return <LoadingSpinner fullscreen />;

  return (
    <div className="animate-fade-in flex flex-col gap-5">
      <button onClick={() => navigate("/admin/tenants")} className="inline-flex w-fit items-center gap-1 text-sm text-aurora-text/60 hover:text-aurora-text">
        <ArrowLeft size={14} /> Back to tenants
      </button>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={openLogoModal} className="group relative shrink-0" aria-label="Edit tenant logo" title="Edit logo">
            {tenant.logoUrl ? (
              <img src={tenant.logoUrl} alt="" className="h-12 w-12 rounded-lg border border-aurora-border object-cover" />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-aurora-accent-soft text-aurora-accent">
                <Building2 size={20} />
              </div>
            )}
            <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-aurora-accent text-white opacity-0 shadow-glass transition group-hover:opacity-100">
              <Pencil size={11} />
            </span>
          </button>
          <div>
            <h2>{tenant.name}</h2>
            <p className="mt-1 text-sm text-aurora-text/60">{tenant.subdomain}.operadash.com &middot; created {formatDate(tenant.createdAt)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <AuroraButton variant="ghost" icon={<LogIn size={16} />} onClick={handleImpersonate}>
            Sign in as admin
          </AuroraButton>
          <AuroraButton variant="ghost" icon={<ScrollText size={16} />} onClick={() => navigate(`/admin/tenants/${tenant.id}/audit-log`)}>
            Audit log
          </AuroraButton>
          <AuroraButton variant="danger" icon={<Trash2 size={16} />} onClick={() => setDeleteOpen(true)}>
            Delete tenant
          </AuroraButton>
        </div>
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

      {tenant.enabledModules.length > 0 && (
        <GlassCard className="flex flex-col gap-4">
          <div>
            <h3>Module features</h3>
            <p className="mt-0.5 text-sm text-aurora-text/60">Turn off specific features within each enabled module for this tenant.</p>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {tenant.enabledModules.map((m) => {
              const rows = features.filter((f) => f.moduleName === m);
              if (rows.length === 0) return null;
              return (
                <div key={m} className="flex flex-col gap-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-aurora-text/40">{titleCase(m)}</p>
                  {rows.map((row) => (
                    <div key={row.featureName} className="rounded-lg px-2 py-1.5 hover:bg-black/5">
                      <Toggle size="sm" label={row.label} checked={row.enabled} onChange={() => toggleFeature(row)} />
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </GlassCard>
      )}

      <GlassCard className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h3>Invoicing details</h3>
            <p className="mt-0.5 text-sm text-aurora-text/60">Company name, address, and tax ID printed on this tenant's invoices.</p>
          </div>
          <AuroraButton size="sm" variant="ghost" icon={<Receipt size={14} />} onClick={openInvoiceModal}>
            Edit
          </AuroraButton>
        </div>
        {(() => {
          const invoice = getInvoiceSettings(tenant);
          return invoice.companyName || invoice.address || invoice.taxId ? (
            <div className="text-sm text-aurora-text/70">
              <p className="font-medium">{invoice.companyName || tenant.name}</p>
              {invoice.address && <p>{invoice.address}</p>}
              {invoice.taxId && <p className="text-aurora-text/50">Tax ID: {invoice.taxId}</p>}
            </div>
          ) : (
            <p className="text-sm text-aurora-text/40">Not set — invoices will fall back to the tenant name and logo only.</p>
          );
        })()}
      </GlassCard>

      <GlassCard padding="none">
        <div className="flex items-center justify-between border-b border-black/10 px-6 py-4">
          <h3>Users</h3>
          <AuroraButton size="sm" variant="ghost" icon={<UserPlus size={14} />} onClick={openAddUser}>
            Add user
          </AuroraButton>
        </div>
        <div className="divide-y divide-black/5">
          {tenant.users.length === 0 && <p className="px-6 py-6 text-sm text-aurora-text/50">No users yet.</p>}
          {tenant.users.map((u) => (
            <div key={u.id} className="flex items-center justify-between gap-3 px-6 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-aurora-accent text-xs font-bold text-white">
                  {initials(u.firstName, u.lastName)}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {u.firstName} {u.lastName}
                  </p>
                  <p className="truncate text-xs text-aurora-text/50">{u.email}</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <span className="aurora-badge border-black/20">{titleCase(u.role)}</span>
                <button
                  onClick={() => openResetPassword(u)}
                  className="rounded-lg p-1.5 text-aurora-text/60 transition hover:bg-black/10 hover:text-aurora-accent"
                  aria-label="Reset password"
                  title="Reset password"
                >
                  <KeyRound size={16} />
                </button>
                <button
                  onClick={() => setDeleteUserTarget(u)}
                  className="rounded-lg p-1.5 text-aurora-text/60 transition hover:bg-black/10 hover:text-aurora-error"
                  aria-label="Remove user"
                  title="Remove user"
                >
                  <X size={16} />
                </button>
              </div>
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

      <Modal
        open={addUserOpen}
        onClose={() => setAddUserOpen(false)}
        title="Add user"
        size="sm"
        footer={
          !newUserCreds && (
            <>
              <AuroraButton variant="ghost" onClick={() => setAddUserOpen(false)}>
                Cancel
              </AuroraButton>
              <AuroraButton isLoading={isSavingUser} onClick={handleAddUser}>
                Create user
              </AuroraButton>
            </>
          )
        }
      >
        {newUserCreds ? (
          <div className="flex flex-col gap-3 text-sm">
            <p className="text-aurora-success">User created! Share these temporary credentials:</p>
            <GlassCard padding="sm" className="font-mono text-xs">
              <p>Email: {newUserCreds.email}</p>
              <p>Temp password: {newUserCreds.password}</p>
            </GlassCard>
            <AuroraButton onClick={() => setAddUserOpen(false)}>Done</AuroraButton>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <GlassSelect
              label="Role"
              options={USER_ROLE_OPTIONS}
              value={userForm.role}
              onChange={(e) => setUserForm((p) => ({ ...p, role: e.target.value as "tenant_admin" | "staff" }))}
            />
            <GlassInput label="Name" required placeholder="Ada Admin" value={userForm.name} onChange={(e) => setUserForm((p) => ({ ...p, name: e.target.value }))} />
            <GlassInput
              label="Email"
              type="email"
              required
              value={userForm.email}
              onChange={(e) => setUserForm((p) => ({ ...p, email: e.target.value }))}
            />
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(passwordTarget)}
        onClose={() => setPasswordTarget(null)}
        title="Reset password"
        size="sm"
        footer={
          <>
            <AuroraButton variant="ghost" onClick={() => setPasswordTarget(null)}>
              Close
            </AuroraButton>
            <AuroraButton isLoading={isSavingPassword} onClick={handleResetPassword}>
              Save new password
            </AuroraButton>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm text-aurora-text/70">
            Set a new password for <strong>{passwordTarget?.email}</strong>. Share it with them directly — this bypasses email entirely.
          </p>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <GlassInput label="New password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="font-mono" />
            </div>
            <AuroraButton variant="ghost" onClick={() => setNewPassword(randomPassword())}>
              Regenerate
            </AuroraButton>
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(deleteUserTarget)}
        onClose={() => setDeleteUserTarget(null)}
        title="Remove user"
        size="sm"
        footer={
          <>
            <AuroraButton variant="ghost" onClick={() => setDeleteUserTarget(null)}>
              Cancel
            </AuroraButton>
            <AuroraButton variant="danger" onClick={handleDeleteUser}>
              Remove
            </AuroraButton>
          </>
        }
      >
        <p className="text-sm text-aurora-text/70">
          Remove <strong>{deleteUserTarget?.email}</strong> from {tenant.name}? They'll lose access immediately.
        </p>
      </Modal>

      <Modal
        open={logoModalOpen}
        onClose={() => setLogoModalOpen(false)}
        title="Tenant logo"
        size="sm"
        footer={
          <>
            <AuroraButton variant="ghost" onClick={() => setLogoModalOpen(false)}>
              Cancel
            </AuroraButton>
            <AuroraButton isLoading={isSavingLogo} onClick={handleSaveLogo}>
              Save
            </AuroraButton>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <GlassInput
            label="Logo image URL"
            placeholder="https://..."
            value={logoUrlInput}
            onChange={(e) => setLogoUrlInput(e.target.value)}
          />
          {logoUrlInput && <img src={logoUrlInput} alt="" className="h-16 w-16 rounded-lg border border-aurora-border object-cover" />}
        </div>
      </Modal>

      <Modal
        open={invoiceModalOpen}
        onClose={() => setInvoiceModalOpen(false)}
        title="Invoicing details"
        size="sm"
        footer={
          <>
            <AuroraButton variant="ghost" onClick={() => setInvoiceModalOpen(false)}>
              Cancel
            </AuroraButton>
            <AuroraButton isLoading={isSavingInvoice} onClick={handleSaveInvoiceSettings}>
              Save
            </AuroraButton>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <GlassInput
            label="Company name"
            placeholder={tenant.name}
            value={invoiceForm.companyName}
            onChange={(e) => setInvoiceForm((f) => ({ ...f, companyName: e.target.value }))}
          />
          <GlassInput
            label="Address"
            placeholder="123 Main St, City, Country"
            value={invoiceForm.address}
            onChange={(e) => setInvoiceForm((f) => ({ ...f, address: e.target.value }))}
          />
          <GlassInput
            label="Tax ID"
            placeholder="e.g. VAT / EIN number"
            value={invoiceForm.taxId}
            onChange={(e) => setInvoiceForm((f) => ({ ...f, taxId: e.target.value }))}
          />
        </div>
      </Modal>
    </div>
  );
}
