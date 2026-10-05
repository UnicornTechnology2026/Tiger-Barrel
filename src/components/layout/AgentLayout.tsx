import { Outlet, NavLink, useNavigate } from "react-router-dom";
import {
  Home,
  MapPin,
  History,
  Image,
  MessageSquare,
  User,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import logo from "../../assest/logo.png";
import bgPrint from "../../assest/bg print.png";

const navItems = [
  { to: "/agent", icon: Home, label: "Home", end: true },
  { to: "/agent/outlets", icon: MapPin, label: "Outlets" },
  { to: "/agent/history", icon: History, label: "History" },
  { to: "/agent/photos", icon: Image, label: "Photos" },
  { to: "/agent/messages", icon: MessageSquare, label: "Messages" },
  { to: "/agent/profile", icon: User, label: "Profile" },
];

export default function AgentLayout() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const { data: unreadCount } = useQuery({
    queryKey: ["unread-messages", profile?.id],
    queryFn: async () => {
      if (!profile) return 0;
      const { count } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("receiver_id", profile.id)
        .eq("is_read", false);
      return count ?? 0;
    },
    enabled: !!profile,
    refetchInterval: 30_000,
  });

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      {/* Top bar */}
      <header
        className="sticky top-0 z-30 border-b border-brand-900 bg-brand-700 bg-cover bg-center"
        style={{ backgroundImage: `url(${bgPrint})` }}
      >
        <div className="mx-auto flex h-14 max-w-lg items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Tiger Barrel" className="h-9 w-auto" />
            <div>
              <p className="text-xs font-semibold tracking-wide text-gold-300">
                Tiger Barrel
              </p>
              <p className="text-sm font-semibold text-white truncate max-w-[160px]">
                {profile?.full_name}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="rounded-lg p-2 text-white hover:bg-white/10"
            aria-label="Logout"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-4 pb-24">
        <Outlet />
      </main>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur safe-area-pb">
        <div className="mx-auto flex max-w-lg items-center justify-around">
          {navItems.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "relative flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors",
                  isActive
                    ? "text-brand-600"
                    : "text-slate-400 hover:text-slate-600",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={cn("h-5 w-5", isActive && "stroke-[2.5]")} />
                  <span>{label}</span>
                  {label === "Messages" && unreadCount && unreadCount > 0 ? (
                    <span className="absolute right-1/4 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-slate-900 px-1 text-[10px] font-bold text-white">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  ) : null}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
