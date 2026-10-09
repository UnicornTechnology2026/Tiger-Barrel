import { useEffect, useState } from "react";
import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  Home,
  MapPin,
  History,
  Image,
  MessageSquare,
  User,
  LogOut,
  ShoppingBag,
  Menu,
  X,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import logo from "../../assest/logo.png";

/* Bottom navigation: only these 4 */
const bottomNavItems = [
  { to: "/agent", icon: Home, label: "Home", end: true },
  { to: "/agent/sale", icon: ShoppingBag, label: "Sales" },
  { to: "/agent/outlets", icon: MapPin, label: "Outlets" },
  { to: "/agent/profile", icon: User, label: "Profile" },
];

/* Hamburger menu items */
const menuItems = [
  { to: "/agent/history", icon: History, label: "History" },
  { to: "/agent/photos", icon: Image, label: "Photos" },
  { to: "/agent/messages", icon: MessageSquare, label: "Messages" },
];

export default function AgentLayout() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

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

  // Close the menu whenever the page changes
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  // Esc to close + lock body scroll while the menu is open
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const handleLogout = async () => {
    setMenuOpen(false);
    await signOut();
    navigate("/login");
  };

  const hasUnread = !!unreadCount && unreadCount > 0;

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-brand-900 bg-brand-700 bg-cover bg-center">
        <div className="mx-auto flex h-14 max-w-lg items-center justify-between px-4">
          <div className="flex items-center gap-2">
            {/* Hamburger button */}
            <button
              onClick={() => setMenuOpen(true)}
              className="relative -ml-2 rounded-lg p-2 text-white hover:bg-white/10"
              aria-label="Open menu"
            >
              <Menu className="h-6 w-6" />
              {hasUnread && (
                <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-gold-400 ring-2 ring-brand-700" />
              )}
            </button>

            <img src={logo} alt="Tiger's Barrel" className="h-9 w-auto" />
            <div>
              <p className="text-xs font-semibold tracking-wide text-gold-300">
                Tiger's Barrel
              </p>
              <p className="max-w-[140px] truncate text-sm font-semibold text-white">
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

      {/* Slide-in hamburger drawer */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300",
          menuOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={() => setMenuOpen(false)}
        aria-hidden="true"
      />
      <aside
        className={cn(
          "fixed bottom-0 left-0 top-0 z-50 flex w-72 max-w-[80%] flex-col bg-white shadow-2xl transition-transform duration-300",
          menuOpen ? "translate-x-0" : "-translate-x-full",
        )}
        role="dialog"
        aria-label="Menu"
      >
        {/* Drawer header */}
        <div className="relative overflow-hidden bg-gradient-to-br from-brand-950 via-brand-800 to-brand-600 px-5 py-5 text-white">
          <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-gold-400/20 blur-2xl" />
          <div className="relative flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <img src={logo} alt="Tiger's Barrel" className="h-10 w-auto" />
              <div className="min-w-0">
                <p className="text-xs font-semibold tracking-wide text-gold-300">
                  Tiger's Barrel
                </p>
                <p className="truncate text-sm font-semibold">
                  {profile?.full_name}
                </p>
              </div>
            </div>
            <button
              onClick={() => setMenuOpen(false)}
              className="rounded-full bg-white/10 p-2 transition hover:bg-white/20"
              aria-label="Close menu"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Drawer links */}
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {menuItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-brand-50 text-brand-700"
                    : "text-slate-700 hover:bg-slate-100",
                )
              }
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold-400/20 text-brand-700">
                <Icon className="h-5 w-5" />
              </span>
              <span className="flex-1">{label}</span>
              {label === "Messages" && hasUnread && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-900 px-1.5 text-[11px] font-bold text-white">
                  {unreadCount! > 9 ? "9+" : unreadCount}
                </span>
              )}
              <ChevronRight className="h-4 w-4 text-slate-300" />
            </NavLink>
          ))}
        </nav>

        {/* Drawer footer */}
        <div className="border-t border-slate-100 p-3">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-50">
              <LogOut className="h-5 w-5" />
            </span>
            Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-4 pb-24">
        <Outlet />
      </main>

      {/* Bottom navigation */}
      <nav className="safe-area-pb fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center justify-around">
          {bottomNavItems.map(({ to, icon: Icon, label, end }) => (
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
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
