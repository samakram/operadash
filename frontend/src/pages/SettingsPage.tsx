import { useState, type FormEvent } from "react";
import { KeyRound, Mail, CreditCard, Palette } from "lucide-react";
import { api, getApiErrorMessage } from "@/lib/api";
import { GlassCard } from "@/components/Common/GlassCard";
import { GlassInput } from "@/components/Common/GlassInput";
import { AuroraButton } from "@/components/Common/AuroraButton";
import { useToast } from "@/components/Common/Toast";

export default function SettingsPage() {
  const { show } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await api.post("/auth/change-password", { currentPassword, newPassword });
      show("Password updated", "success");
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      show(getApiErrorMessage(err, "Failed to change password"), "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="animate-fade-in flex flex-col gap-5">
      <div>
        <h2>Settings</h2>
        <p className="mt-1 text-sm text-aurora-text/60">Platform administration</p>
      </div>

      <GlassCard className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <KeyRound size={18} className="text-aurora-cyan" />
          <h3>Admin account</h3>
        </div>
        <form onSubmit={handleChangePassword} className="grid max-w-md gap-4">
          <GlassInput
            label="Current password"
            type="password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
          <GlassInput
            label="New password"
            type="password"
            required
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <AuroraButton type="submit" isLoading={isSaving} className="w-fit">
            Update password
          </AuroraButton>
        </form>
      </GlassCard>

      <GlassCard className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Mail size={18} className="text-aurora-blue" />
          <h3>Email configuration</h3>
        </div>
        <p className="text-sm text-aurora-text/60">
          Welcome emails (on tenant/staff creation) and password-reset links are sent via SMTP, configured with backend
          environment variables (<code className="rounded bg-black/10 px-1.5 py-0.5">SMTP_HOST</code>,{" "}
          <code className="rounded bg-black/10 px-1.5 py-0.5">SMTP_USER</code>, etc. — see{" "}
          <code className="rounded bg-black/10 px-1.5 py-0.5">backend/.env.example</code>). Until{" "}
          <code className="rounded bg-black/10 px-1.5 py-0.5">SMTP_HOST</code> is set, emails are logged instead of sent, so
          nothing breaks without a mail provider configured. Appointment/tuition reminder emails from the original spec aren't
          scheduled anywhere yet — only welcome and password-reset are wired up.
        </p>
      </GlassCard>

      <GlassCard className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <CreditCard size={18} className="text-aurora-purple" />
          <h3>Stripe API keys</h3>
        </div>
        <p className="text-sm text-aurora-text/60">
          Test-mode keys are read from <code className="rounded bg-black/10 px-1.5 py-0.5">STRIPE_SECRET_KEY</code> and{" "}
          <code className="rounded bg-black/10 px-1.5 py-0.5">STRIPE_WEBHOOK_SECRET</code> on the backend. Checkout sessions are created via{" "}
          <code className="rounded bg-black/10 px-1.5 py-0.5">POST /api/billing/checkout-session</code>.
        </p>
      </GlassCard>

      <GlassCard className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Palette size={18} className="text-aurora-cyan" />
          <h3>Brand customization</h3>
        </div>
        <p className="text-sm text-aurora-text/60">
          OperaDash ships with the Aurora glassmorphism theme (purple / blue / cyan). Per-tenant logo upload is available on each tenant's
          detail page.
        </p>
      </GlassCard>
    </div>
  );
}
