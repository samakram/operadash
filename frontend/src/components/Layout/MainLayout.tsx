import { useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { Undo2 } from "lucide-react";
import { Sidebar } from "@/components/Layout/Sidebar";
import { Navbar } from "@/components/Layout/Navbar";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";

function ImpersonationBanner() {
  const { returnToAdmin } = useAuth();
  const { tenant } = useTenant();
  const navigate = useNavigate();

  const handleReturn = async () => {
    await returnToAdmin();
    navigate("/admin/tenants");
  };

  return (
    <div className="flex shrink-0 items-center justify-center gap-3 bg-aurora-warning px-4 py-2 text-sm font-medium text-white">
      <span>Viewing as {tenant ? tenant.name : "this tenant"} — you're signed in as their admin</span>
      <button onClick={handleReturn} className="inline-flex items-center gap-1.5 rounded-md bg-white/20 px-2.5 py-1 hover:bg-white/30">
        <Undo2 size={14} /> Return to admin
      </button>
    </div>
  );
}

export function MainLayout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { impersonating } = useAuth();

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden">
      {impersonating && <ImpersonationBanner />}
      <div className="flex min-h-0 w-full flex-1 overflow-hidden">
        <Sidebar mobileOpen={mobileNavOpen} onCloseMobile={() => setMobileNavOpen(false)} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Navbar onOpenMobileNav={() => setMobileNavOpen(true)} />
          <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
