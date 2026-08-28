import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import { useAuthContext } from "@/context/AuthContext";

export type ModuleName = "hotel" | "student" | "patient" | "restaurant";
export type PlanTier = "free" | "starter" | "pro" | "enterprise";

export interface Tenant {
  id: string;
  name: string;
  subdomain: string;
  domain: string | null;
  plan: PlanTier;
  enabledModules: ModuleName[];
  logoUrl: string | null;
  active: boolean;
  monthlyRevenue: string;
}

interface TenantContextValue {
  tenant: Tenant | null;
  isLoading: boolean;
  refetch: () => Promise<void>;
}

const TenantContext = createContext<TenantContextValue | undefined>(undefined);

export function TenantProvider({ children }: { children: ReactNode }) {
  const { user } = useAuthContext();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTenant = useCallback(async () => {
    if (!user || user.role === "super_admin") {
      setTenant(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const { data } = await api.get<Tenant>("/tenants/me");
      setTenant(data);
    } catch {
      setTenant(null);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void fetchTenant();
  }, [fetchTenant]);

  const value = useMemo(() => ({ tenant, isLoading, refetch: fetchTenant }), [tenant, isLoading, fetchTenant]);

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenantContext(): TenantContextValue {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useTenantContext must be used within a TenantProvider");
  return ctx;
}
