import { useState, type FormEvent } from "react";
import { KeyRound, Mail, CreditCard, Palette } from "lucide-react";
import { api, getApiErrorMessage } from "@/lib/api";
import { GlassCard } from "@/components/Common/GlassCard";
import { GlassInput } from "@/components/Common/GlassInput";
import { AuroraButton } from "@/components/Common/AuroraButton";
import { useToast } from "@/components/Common/Toast";

function InfoCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <GlassCard padding="sm" className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-aurora-accent-soft text-aurora-accent">{icon}</div>
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <p className="text-xs leading-relaxed text-aurora-text/60">{children}</p>
    </GlassCard>
  );
}

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

      <GlassCard padding="sm" className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-aurora-accent-soft text-aurora-accent">
            <KeyRound size={16} />
          </div>
          <h3 className="text-sm font-semibold">Admin account</h3>
        </div>
        <form onSubmit={handleChangePassword} className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
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
          <AuroraButton type="submit" isLoading={isSaving}>
            Update
          </AuroraButton>
        </form>
      </GlassCard>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <InfoCard icon={<Mail size={16} />} title="Email configuration">
          Welcome and password-reset emails send via SMTP (<code className="rounded bg-black/10 px-1 py-0.5">SMTP_HOST</code> etc. on the
          backend). Unconfigured, they're logged instead of sent.
        </InfoCard>

        <InfoCard icon={<CreditCard size={16} />} title="Stripe API keys">
          Test-mode keys read from <code className="rounded bg-black/10 px-1 py-0.5">STRIPE_SECRET_KEY</code> /{" "}
          <code className="rounded bg-black/10 px-1 py-0.5">STRIPE_WEBHOOK_SECRET</code> on the backend.
        </InfoCard>

        <InfoCard icon={<Palette size={16} />} title="Brand customization">
          Per-tenant logo upload is available on each tenant's detail page.
        </InfoCard>
      </div>
    </div>
  );
}
