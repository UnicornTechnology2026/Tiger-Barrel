import {
  Outlet,
  NavLink,
  Link,
  useNavigate,
  useLocation,
} from "react-router-dom";
import {
  Home,
  MapPin,
  History,
  Image,
  MessageSquare,
  User,
  LogOut,
  ShoppingBag,
  Bell,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import logo from "../../assest/logo.png";

const navItems = [
  { to: "/agent", icon: Home, label: "Home", end: true },
  { to: "/agent/sale", icon: ShoppingBag, label: "Sale" },
  { to: "/agent/outlets", icon: MapPin, label: "Outlets" },
  { to: "/agent/history", icon: History, label: "History" },
  { to: "/agent/photos", icon: Image, label: "Photos" },
  { to: "/agent/messages", icon: MessageSquare, label: "Messages" },
  { to: "/agent/profile", icon: User, label: "Profile" },
];

function initials(name?: string | null) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function pageTitle(pathname: string) {
  if (pathname.startsWith("/agent/outlets")) return "Outlets";
  if (pathname.startsWith("/agent/visit")) return "Visit";
  if (pathname.startsWith("/agent/history")) return "Visit History";
  if (pathname.startsWith("/agent/photos")) return "Photos";
  if (pathname.startsWith("/agent/messages")) return "Messages";
  if (pathname.startsWith("/agent/profile")) return "Profile";
  if (pathname.startsWith("/agent/sale")) return "Sale";
  return "Dashboard";
}

export default function AgentLayout() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

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

  const unread = unreadCount ?? 0;

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      {/* ───────── Top header ───────── */}
      <header className="sticky top-0 z-30 overflow-hidden bg-gradient-to-br from-brand-950 via-brand-800 to-brand-700 shadow-md">
        {/* decorative glows */}
        <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gold-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-12 left-1/3 h-24 w-24 rounded-full bg-white/10 blur-3xl" />
        {/* gold accent line */}
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-gold-400/70 to-transparent" />

        <div className="relative mx-auto flex h-16 max-w-lg items-center justify-between gap-3 px-4">
          {/* Brand + current page */}
          <Link to="/agent" className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/95 p-1 shadow-sm ring-1 ring-gold-400/40">
              <img src={logo} alt="Tiger's Barrel" className="h-full w-auto" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-gold-300">
                Tiger&apos;s Barrel
              </p>
              <p className="truncate text-base font-bold leading-tight text-white">
                {pageTitle(pathname)}
              </p>
            </div>
          </Link>

          {/* Actions */}
          <div className="flex shrink-0 items-center gap-1.5">
            <Link
              to="/agent/messages"
              className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-inset ring-white/15 transition-colors hover:bg-white/20"
              aria-label={
                unread > 0 ? `${unread} unread messages` : "Notifications"
              }
            >
              <Bell className="h-[18px] w-[18px]" />
              {unread > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold-400 px-1 text-[10px] font-bold text-brand-950 ring-2 ring-brand-800">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Link>

            <Link
              to="/agent/profile"
              className="flex items-center gap-2 rounded-full bg-white/10 py-1 pl-1 pr-3 ring-1 ring-inset ring-white/15 transition-colors hover:bg-white/20"
              aria-label="My profile"
            >
              {profile?.profile_photo_url ? (
                <img
                  src={profile.profile_photo_url}
                  alt=""
                  className="h-7 w-7 rounded-full object-cover ring-1 ring-gold-400"
                />
              ) : (
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gold-400 text-[11px] font-bold text-brand-950">
                  {initials(profile?.full_name)}
                </span>
              )}
              <span className="hidden max-w-[84px] truncate text-xs font-semibold text-white min-[380px]:block">
                {profile?.full_name?.split(" ")[0]}
              </span>
            </Link>

            <button
              onClick={handleLogout}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-inset ring-white/15 transition-colors hover:bg-red-500/70"
              aria-label="Logout"
              title="Logout"
            >
              <LogOut className="h-[18px] w-[18px]" />
            </button>
          </div>
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
