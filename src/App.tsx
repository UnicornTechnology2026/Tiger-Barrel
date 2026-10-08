import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/shared/ProtectedRoute";
import { LoadingScreen } from "@/components/shared/LoadingScreen";

// Auth pages
import LoginPage from "@/pages/auth/LoginPage";
import ForgotPasswordPage from "@/pages/auth/ForgotPasswordPage";
import ResetPasswordPage from "@/pages/auth/ResetPasswordPage";

// Agent pages
import AgentDashboard from "@/pages/agent/Dashboard";
import MyOutlets from "@/pages/agent/MyOutlets";
import OutletDetail from "@/pages/agent/OutletDetail";
import StartVisit from "@/pages/agent/StartVisit";
import VisitHistory from "@/pages/agent/VisitHistory";
import MyPhotos from "@/pages/agent/MyPhotos";
import MyMessages from "@/pages/agent/MyMessages";
import MyProfile from "@/pages/agent/MyProfile";
import AgentLayout from "@/components/layout/AgentLayout";
import Sale from "@/pages/agent/Sales";

// Admin pages
import AdminDashboard from "@/pages/admin/Dashboard";
import AgentList from "@/pages/admin/AgentList";
import AgentDetail from "@/pages/admin/AgentDetail";
import OutletList from "@/pages/admin/OutletList";
import OutletDetailAdmin from "@/pages/admin/OutletDetail";
import LiveTracking from "@/pages/admin/LiveTracking";
import VisitsPage from "@/pages/admin/VisitsPage";
import PhotosGallery from "@/pages/admin/PhotosGallery";
import CommentsPage from "@/pages/admin/CommentsPage";
import MessagesPage from "@/pages/admin/MessagesPage";
import ReportsPage from "@/pages/admin/ReportsPage";
import AuditLogsPage from "@/pages/admin/AuditLogsPage";
import SettingsPage from "@/pages/admin/SettingsPage";
import AdminProfile from "@/pages/admin/AdminProfile";
import AdminLayout from "@/components/layout/AdminLayout";

function App() {
  const { loading, profile } = useAuth();

  if (loading) return <LoadingScreen />;

  return (
    <Routes>
      {/* Public auth routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* Agent routes */}
      <Route
        path="/agent"
        element={
          <ProtectedRoute role="agent">
            <AgentLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AgentDashboard />} />
        <Route path="outlets" element={<MyOutlets />} />
        <Route path="outlets/:id" element={<OutletDetail />} />
        <Route path="visit/:outletId" element={<StartVisit />} />
        <Route path="history" element={<VisitHistory />} />
        <Route path="photos" element={<MyPhotos />} />
        <Route path="messages" element={<MyMessages />} />
        <Route path="profile" element={<MyProfile />} />
        <Route path="sale" element={<Sale />} />
      </Route>

      {/* Admin routes */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute role="admin">
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="agents" element={<AgentList />} />
        <Route path="agents/:id" element={<AgentDetail />} />
        <Route path="outlets" element={<OutletList />} />
        <Route path="outlets/:id" element={<OutletDetailAdmin />} />
        <Route path="tracking" element={<LiveTracking />} />
        <Route path="visits" element={<VisitsPage />} />
        <Route path="photos" element={<PhotosGallery />} />
        <Route path="comments" element={<CommentsPage />} />
        <Route path="messages" element={<MessagesPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="audit" element={<AuditLogsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="profile" element={<AdminProfile />} />
      </Route>

      {/* Root redirect based on role */}
      <Route
        path="/"
        element={
          profile ? (
            <Navigate
              to={profile.role === "admin" ? "/admin" : "/agent"}
              replace
            />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
