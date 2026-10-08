import { Outlet, NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Store,
  Map,
  ClipboardList,
  Image,
  MessageSquare,
  FileText,
  Settings,
  LogOut,
  Shield,
  IndianRupee,
  X,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { useState } from "react";
import logoText from "@/assest/logo_text.png";
import desktopBg from "@/assest/desktop_view.png";
import mobileBg from "@/assest/mobile_view.png";

const navItems = [
  { to: "/admin", icon: LayoutDashboard, label: "Dashboard", end: true },
  { to: "/admin/agents", icon: Users, label: "Promoters" },
  { to: "/admin/outlets", icon: Store, label: "Outlets" },
  { to: "/admin/tracking", icon: Map, label: "Live Tracking" },
  { to: "/admin/visits", icon: ClipboardList, label: "Visits" },
  { to: "/admin/sales", icon: IndianRupee, label: "Sales" },
  { to: "/admin/photos", icon: Image, label: "Photos" },
  { to: "/admin/comments", icon: MessageSquare, label: "Comments" },
  { to: "/admin/messages", icon: MessageSquare, label: "Messages" },
  { to: "/admin/reports", icon: FileText, label: "Reports" },
  { to: "/admin/audit", icon: Shield, label: "Audit Logs" },
  { to: "/admin/settings", icon: Settings, label: "Settings" },
];

export default function AdminLayout() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  const NavContent = () => (
    <>
      <div className="flex h-16 items-center justify-center border-b border-white/15 px-4">
        <img src={logoText} alt="Tiger's Barrel" className="h-14 w-auto" />
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {navItems.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-white text-brand-700 shadow-sm"
                  : "text-red-50 hover:bg-white/10 hover:text-white",
              )
            }
          >
            <Icon className="h-5 w-5 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-white/15 p-3">
        <div className="mb-2 flex items-center gap-3 px-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-brand-700 text-sm font-semibold">
            {profile?.full_name?.charAt(0) ?? "A"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">
              {profile?.full_name}
            </p>
            <p className="truncate text-xs text-red-100/80">{profile?.email}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-red-50 hover:bg-white/10"
        >
          <LogOut className="h-5 w-5" />
          Sign out
        </button>
      </div>
    </>
  );

  return (
    <div className="relative isolate flex min-h-screen bg-slate-50">
      <div
        aria-hidden
        className="fixed inset-0 -z-10 bg-cover bg-center bg-no-repeat lg:hidden"
        style={{ backgroundImage: `url(${mobileBg})` }}
      />
      <div
        aria-hidden
        className="fixed inset-0 -z-10 hidden bg-cover bg-center bg-no-repeat lg:block"
        style={{ backgroundImage: `url(${desktopBg})` }}
      />
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-brand-900 bg-brand-700 bg-cover bg-center lg:flex">
        <NavContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="absolute left-0 top-0 flex h-full w-64 flex-col bg-brand-700 bg-cover bg-center shadow-xl">
            <button
              className="absolute right-3 top-4 rounded-lg p-1 text-white"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
            <NavContent />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex flex-1 flex-col min-w-0">
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
