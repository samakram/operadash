import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Sparkles, ArrowLeft } from "lucide-react";
import { GlassCard } from "@/components/Common/GlassCard";
import { GlassInput } from "@/components/Common/GlassInput";
import { AuroraButton } from "@/components/Common/AuroraButton";
import { api, getApiErrorMessage } from "@/lib/api";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await api.post("/auth/forgot-password", { email });
      // Always show the same success state, whether or not the account
      // exists — the backend response is identical either way too.
      setSent(true);
    } catch (err) {
      setError(getApiErrorMessage(err, "Something went wrong. Try again."));
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
          <h1 className="aurora-text-gradient">Reset your password</h1>
          <p className="text-sm text-aurora-text/60">We'll email you a link to get back in.</p>
        </div>

        {sent ? (
          <p className="text-center text-sm text-aurora-text/70">
            If <strong>{email}</strong> has an account, a reset link is on its way. It expires in 1 hour.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <GlassInput
              label="Email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {error && <p className="text-sm text-aurora-error">{error}</p>}
            <AuroraButton type="submit" size="lg" isLoading={isSubmitting} className="mt-2 w-full">
              Send reset link
            </AuroraButton>
          </form>
        )}

        <Link to="/login" className="mt-6 flex items-center justify-center gap-1 text-xs text-aurora-text/40 hover:text-aurora-text/70">
          <ArrowLeft size={12} /> Back to sign in
        </Link>
      </GlassCard>
    </div>
  );
}
