import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, getApiErrorMessage } from "@/lib/api";

export type Role = "super_admin" | "tenant_admin" | "staff";

export interface AuthUser {
  id: string;
  email: string;
  tenantId: string | null;
  role: Role;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  active: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refetch: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchMe = useCallback(async () => {
    try {
      const { data } = await api.get<{ user: AuthUser }>("/auth/me");
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchMe();
  }, [fetchMe]);

  useEffect(() => {
    const onExpired = () => setUser(null);
    window.addEventListener("operadash:session-expired", onExpired);
    return () => window.removeEventListener("operadash:session-expired", onExpired);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const { data } = await api.post<{ user: AuthUser }>("/auth/login", { email, password });
      setUser(data.user);
    } catch (err) {
      throw new Error(getApiErrorMessage(err, "Unable to sign in"));
    }
  }, []);

  const logout = useCallback(async () => {
    await api.post("/auth/logout").catch(() => undefined);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, isLoading, login, logout, refetch: fetchMe }),
    [user, isLoading, login, logout, fetchMe],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuthContext must be used within an AuthProvider");
  return ctx;
}
