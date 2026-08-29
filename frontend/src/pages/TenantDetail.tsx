import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Trash2, LogIn, UserPlus, KeyRound, X } from "lucide-react";
import { api, getApiErrorMessage } from "@/lib/api";
import { GlassCard } from "@/components/Common/GlassCard";
import { AuroraButton } from "@/components/Common/AuroraButton";
import { GlassInput, GlassSelect } from "@/components/Common/GlassInput";
import { Modal } from "@/components/Common/Modal";
import { LoadingSpinner } from "@/components/Common/LoadingSpinner";
import { useToast } from "@/components/Common/Toast";
import { Toggle } from "@/components/Common/Toggle";
import { useAuth } from "@/hooks/useAuth";
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
const USER_ROLE_OPTIONS = [
  { value: "tenant_admin", label: "Admin" },
  { value: "staff", label: "Staff" },
];

const emptyUserForm = { email: "", firstName: "", lastName: "", role: "tenant_admin" as "tenant_admin" | "staff" };

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

  const [addUserOpen, setAddUserOpen] = useState(false);
  const [userForm, setUserForm] = useState(emptyUserForm);
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [newUserCreds, setNewUserCreds] = useState<{ email: string; password: string } | null>(null);

  const [passwordTarget, setPasswordTarget] = useState<TenantUser | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  const [deleteUserTarget, setDeleteUserTarget] = useState<TenantUser | null>(null);

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
      const { data } = await api.post("/users", { ...userForm, tenantId: tenant.id });
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
        <div>
          <h2>{tenant.name}</h2>
          <p className="mt-1 text-sm text-aurora-text/60">{tenant.subdomain}.operadash.com &middot; created {formatDate(tenant.createdAt)}</p>
        </div>
        <div className="flex items-center gap-2">
          <AuroraButton variant="ghost" icon={<LogIn size={16} />} onClick={handleImpersonate}>
            Sign in as admin
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
            <GlassInput label="First name" required value={userForm.firstName} onChange={(e) => setUserForm((p) => ({ ...p, firstName: e.target.value }))} />
            <GlassInput label="Last name" required value={userForm.lastName} onChange={(e) => setUserForm((p) => ({ ...p, lastName: e.target.value }))} />
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
    </div>
  );
}
