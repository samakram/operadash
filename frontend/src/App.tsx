import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { TenantProvider } from "@/context/TenantContext";
import { ToastProvider } from "@/components/Common/Toast";
import { MainLayout } from "@/components/Layout/MainLayout";
import { RequireAuth, RequireRole } from "@/components/Layout/RouteGuards";
import { useAuth } from "@/hooks/useAuth";
import { LoadingSpinner } from "@/components/Common/LoadingSpinner";

import Login from "@/pages/Login";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import NotFound from "@/pages/NotFound";
import TenantsList from "@/pages/TenantsList";
import TenantDetail from "@/pages/TenantDetail";
import ModulesPage from "@/pages/ModulesPage";
import AnalyticsPage from "@/pages/AnalyticsPage";
import SettingsPage from "@/pages/SettingsPage";
import TenantDashboard from "@/pages/TenantDashboard";
import StaffPage from "@/pages/StaffPage";
import HotelCRM from "@/pages/HotelCRM";
import StudentCRM from "@/pages/StudentCRM";
import PatientCRM from "@/pages/PatientCRM";
import RestaurantCRM from "@/pages/RestaurantCRM";
import SupportPage from "@/pages/SupportPage";
import SupportTicketDetail from "@/pages/SupportTicketDetail";
import AuditLogPage from "@/pages/AuditLogPage";

function RootRedirect() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <LoadingSpinner fullscreen />;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === "super_admin" ? "/admin/tenants" : "/app"} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <TenantProvider>
        <ToastProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/" element={<RootRedirect />} />

            <Route
              path="/admin"
              element={
                <RequireAuth>
                  <RequireRole roles={["super_admin"]}>
                    <MainLayout />
                  </RequireRole>
                </RequireAuth>
              }
            >
              <Route path="tenants" element={<TenantsList />} />
              <Route path="tenants/:id" element={<TenantDetail />} />
              <Route path="tenants/:id/audit-log" element={<AuditLogPage />} />
              <Route path="modules" element={<ModulesPage />} />
              <Route path="analytics" element={<AnalyticsPage />} />
              <Route path="support" element={<SupportPage />} />
              <Route path="support/:id" element={<SupportTicketDetail />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route index element={<Navigate to="tenants" replace />} />
            </Route>

            <Route
              path="/app"
              element={
                <RequireAuth>
                  <RequireRole roles={["tenant_admin", "staff"]}>
                    <MainLayout />
                  </RequireRole>
                </RequireAuth>
              }
            >
              <Route index element={<TenantDashboard />} />
              <Route path="hotel/*" element={<HotelCRM />} />
              <Route path="student/*" element={<StudentCRM />} />
              <Route path="patient/*" element={<PatientCRM />} />
              <Route path="restaurant/*" element={<RestaurantCRM />} />
              <Route path="support" element={<SupportPage />} />
              <Route path="support/:id" element={<SupportTicketDetail />} />
              <Route
                path="staff"
                element={
                  <RequireRole roles={["tenant_admin"]}>
                    <StaffPage />
                  </RequireRole>
                }
              />
              <Route
                path="audit-log"
                element={
                  <RequireRole roles={["tenant_admin"]}>
                    <AuditLogPage />
                  </RequireRole>
                }
              />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </ToastProvider>
      </TenantProvider>
    </AuthProvider>
  );
}
