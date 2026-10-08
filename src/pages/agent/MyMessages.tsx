import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import {
  MessageSquare,
  Mail,
  MailOpen,
  CalendarDays,
  Inbox,
  CheckCheck,
} from "lucide-react";
import { formatDate, getTodayISO, cn } from "@/lib/utils";
import type { Message } from "@/types";

type MessageWithSender = Message & { sender?: { full_name: string } | null };
type Filter = "all" | "unread";

function initials(name?: string | null) {
  if (!name) return "A";
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function dayKey(iso: string) {
  return new Date(iso).toLocaleDateString("en-CA"); // YYYY-MM-DD, local time
}

function dayLabel(key: string, today: string) {
  const d = new Date(`${key}T12:00:00`);
  const t = new Date(`${today}T12:00:00`);
  const diff = Math.round((t.getTime() - d.getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return formatDate(d, "long");
}

export default function MyMessages() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const today = getTodayISO();

  const [filter, setFilter] = useState<Filter>("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // Remember which messages were unread when the page opened,
  // so the "New" badges stay visible even after we mark them as read.
  const newIds = useRef<Set<string>>(new Set());
  const [, forceRender] = useState(0);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["agent-messages", profile?.id],
    queryFn: async () => {
      if (!profile) return [];
      const { data, error } = await supabase
        .from("messages")
        .select("*, sender:profiles!sender_id(full_name)")
        .eq("receiver_id", profile.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as MessageWithSender[];
    },
    enabled: !!profile,
  });

  // Mark unread as read (same behaviour as before)
  useEffect(() => {
    if (!profile || !messages.length) return;
    const unread = messages.filter((m) => !m.is_read).map((m) => m.id);
    if (!unread.length) return;

    let added = false;
    unread.forEach((id) => {
      if (!newIds.current.has(id)) {
        newIds.current.add(id);
        added = true;
      }
    });
    if (added) forceRender((n) => n + 1);

    supabase
      .from("messages")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .in("id", unread)
      .then(() => qc.invalidateQueries({ queryKey: ["unread-messages"] }));
  }, [messages, profile, qc]);

  const isNew = (m: Message) => !m.is_read || newIds.current.has(m.id);

  /* ───────── Stats ───────── */
  const stats = useMemo(() => {
    const todayCount = messages.filter(
      (m) => dayKey(m.created_at) === today,
    ).length;
    const unread = messages.filter(
      (m) => !m.is_read || newIds.current.has(m.id),
    ).length;
    return {
      total: messages.length,
      unread,
      read: messages.length - unread,
      today: todayCount,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, today, newIds.current.size]);

  /* ───────── Filter + group by day ───────── */
  const groups = useMemo(() => {
    const list =
      filter === "unread"
        ? messages.filter((m) => !m.is_read || newIds.current.has(m.id))
        : messages;
    const map = new Map<string, MessageWithSender[]>();
    list.forEach((m) => {
      const k = dayKey(m.created_at);
      map.set(k, [...(map.get(k) ?? []), m]);
    });
    return Array.from(map.entries());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, filter, newIds.current.size]);

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <div className="space-y-5">
      {/* ───────── Hero header ───────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-950 via-brand-800 to-brand-600 p-5 text-white shadow-lg">
        <div className="pointer-events-none absolute -right-14 -top-14 h-48 w-48 rounded-full bg-gold-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 left-1/3 h-40 w-40 rounded-full bg-white/10 blur-3xl" />

        <div className="relative">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-gold-300 ring-1 ring-inset ring-gold-400/30">
                <MessageSquare className="h-3.5 w-3.5" />
                Inbox
              </div>
              <h1 className="text-xl font-bold tracking-tight">My Messages</h1>
              <p className="mt-0.5 text-sm text-white/70">
                {stats.unread > 0
                  ? `You have ${stats.unread} new message${stats.unread > 1 ? "s" : ""}`
                  : "You're all caught up"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold leading-none">{stats.total}</p>
              <p className="mt-1 text-[10px] uppercase tracking-wide text-white/60">
                Total
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2.5">
            <StatChip icon={Mail} label="New" value={stats.unread} />
            <StatChip icon={MailOpen} label="Read" value={stats.read} />
            <StatChip icon={CalendarDays} label="Today" value={stats.today} />
          </div>
        </div>
      </div>

      {/* ───────── Filters ───────── */}
      {!isLoading && messages.length > 0 && (
        <div className="flex gap-2">
          {(
            [
              ["all", "All", stats.total],
              ["unread", "New", stats.unread],
            ] as [Filter, string, number][]
          ).map(([key, label, count]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold ring-1 ring-inset transition-colors",
                filter === key
                  ? "bg-brand-600 text-white ring-brand-600"
                  : "bg-white text-slate-600 ring-slate-200 hover:ring-brand-300",
              )}
            >
              {label}
              <span
                className={cn(
                  "rounded-full px-1.5 text-[10px] font-bold",
                  filter === key ? "bg-white/20" : "bg-slate-100",
                )}
              >
                {count}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* ───────── Content ───────── */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200"
            />
          ))}
        </div>
      ) : messages.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white/60 px-6 py-14 text-center">
          <div className="mb-4 rounded-full bg-brand-50 p-5 ring-8 ring-brand-50/50">
            <Inbox className="h-8 w-8 text-brand-600" />
          </div>
          <h3 className="text-base font-semibold text-slate-900">
            No messages yet
          </h3>
          <p className="mt-1 max-w-xs text-sm text-slate-500">
            Messages from your administrator will appear here.
          </p>
        </div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl bg-emerald-50 p-6 text-center ring-1 ring-emerald-200">
          <CheckCheck className="mb-2 h-6 w-6 text-emerald-600" />
          <p className="text-sm font-semibold text-emerald-800">
            No new messages
          </p>
          <p className="text-xs text-emerald-700">You've read everything.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map(([key, items]) => (
            <section key={key}>
              <div className="mb-2.5 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <CalendarDays className="h-4 w-4 text-brand-600" />
                  {dayLabel(key, today)}
                </h2>
                <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700">
                  {items.length}
                </span>
              </div>

              <div className="space-y-3">
                {items.map((m) => {
                  const fresh = isNew(m);
                  const name = m.sender?.full_name ?? "Admin";
                  const long = m.message_text.length > 140;
                  const open = expanded.has(m.id);

                  return (
                    <article
                      key={m.id}
                      className={cn(
                        "relative overflow-hidden rounded-2xl bg-white p-4 shadow-sm ring-1 transition-all",
                        fresh ? "ring-brand-200" : "ring-slate-200",
                      )}
                    >
                      {fresh && (
                        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 to-gold-400" />
                      )}

                      <div className="flex items-start gap-3">
                        <span
                          className={cn(
                            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold ring-1 ring-inset",
                            fresh
                              ? "bg-gold-400 text-brand-950 ring-gold-500/30"
                              : "bg-slate-100 text-slate-500 ring-slate-200",
                          )}
                        >
                          {initials(name)}
                        </span>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h3 className="truncate text-sm font-semibold text-slate-900">
                                {name}
                              </h3>
                              <p className="text-[11px] text-slate-400">
                                {formatDate(m.created_at, "time")}
                              </p>
                            </div>
                            {fresh ? (
                              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-700 ring-1 ring-inset ring-brand-200">
                                <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
                                New
                              </span>
                            ) : (
                              <CheckCheck className="h-4 w-4 shrink-0 text-emerald-500" />
                            )}
                          </div>

                          <p
                            className={cn(
                              "mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700",
                              long && !open && "line-clamp-3",
                            )}
                          >
                            {m.message_text}
                          </p>

                          {long && (
                            <button
                              onClick={() => toggle(m.id)}
                              className="mt-1.5 text-xs font-semibold text-brand-600 hover:text-brand-700"
                            >
                              {open ? "Show less" : "Read more"}
                            </button>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

/* ───────── Small helper components ───────── */

function StatChip({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
}) {
  return (
    <div className="flex flex-col items-start gap-1.5 rounded-xl bg-white/10 px-3 py-2.5 ring-1 ring-inset ring-white/15 backdrop-blur-sm">
      <Icon className="h-4 w-4 text-gold-300" />
      <div>
        <p className="text-lg font-bold leading-none">{value}</p>
        <p className="mt-1 text-[10px] uppercase tracking-wide text-white/60">
          {label}
        </p>
      </div>
    </div>
  );
}
