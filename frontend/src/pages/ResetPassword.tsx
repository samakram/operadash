import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Sparkles, CheckCircle2 } from "lucide-react";
import { GlassCard } from "@/components/Common/GlassCard";
import { GlassInput } from "@/components/Common/GlassInput";
import { AuroraButton } from "@/components/Common/AuroraButton";
import { api, getApiErrorMessage } from "@/lib/api";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }
    if (!token) {
      setError("This reset link is missing its token — request a new one");
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post("/auth/reset-password", { token, newPassword });
      setDone(true);
      setTimeout(() => navigate("/login"), 2500);
    } catch (err) {
      setError(getApiErrorMessage(err, "This reset link is invalid or has expired"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <GlassCard padding="lg" className="w-full max-w-md animate-slide-in">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-aurora-gradient shadow-glass-hover">
            <Sparkles size={26} />
          </div>
          <h1 className="aurora-text-gradient">Set a new password</h1>
        </div>

        {done ? (
          <div className="flex flex-col items-center gap-2 text-center text-sm text-aurora-text/70">
            <CheckCircle2 className="text-aurora-success" size={28} />
            <p>Password updated. Redirecting you to sign in&hellip;</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <GlassInput
              label="New password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <GlassInput
              label="Confirm new password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            {error && <p className="text-sm text-aurora-error">{error}</p>}
            <AuroraButton type="submit" size="lg" isLoading={isSubmitting} className="mt-2 w-full">
              Update password
            </AuroraButton>
          </form>
        )}

        {!done && (
          <Link to="/forgot-password" className="mt-6 block text-center text-xs text-aurora-text/40 hover:text-aurora-text/70">
            Need a new link?
          </Link>
        )}
      </GlassCard>
    </div>
  );
}
