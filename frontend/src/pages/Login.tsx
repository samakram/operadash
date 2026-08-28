import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { GlassCard } from "@/components/Common/GlassCard";
import { GlassInput } from "@/components/Common/GlassInput";
import { AuroraButton } from "@/components/Common/AuroraButton";
import { Toggle } from "@/components/Common/Toggle";
import { useAuth } from "@/hooks/useAuth";

export default function Login() {
  const { user, isLoading, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isLoading && user) {
    return <Navigate to={user.role === "super_admin" ? "/admin/tenants" : "/app"} replace />;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login(email, password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in");
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
          <h1 className="aurora-text-gradient">OperaDash</h1>
          <p className="text-sm text-aurora-text/60">Sign in to your operations dashboard</p>
        </div>

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
          <GlassInput
            label="Password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <Toggle size="sm" label="Remember me" checked={rememberMe} onChange={setRememberMe} />

          {error && <p className="text-sm text-aurora-error">{error}</p>}

          <AuroraButton type="submit" size="lg" isLoading={isSubmitting} className="mt-2 w-full">
            Sign in
          </AuroraButton>
        </form>

        <div className="mt-5 flex items-center justify-center gap-3 text-[11px] text-aurora-text/35">
          <span>Need access? Contact your admin</span>
          <span className="text-aurora-text/20">&middot;</span>
          <Link to="/forgot-password" className="hover:text-aurora-text/60">
            Forgot password?
          </Link>
        </div>
      </GlassCard>
    </div>
  );
}
