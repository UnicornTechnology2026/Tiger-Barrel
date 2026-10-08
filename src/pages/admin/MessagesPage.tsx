import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  MessageSquare,
  Send,
  Search,
  Users,
  ArrowLeft,
  Check,
  CheckCheck,
  MapPin,
  Clock,
  X,
} from "lucide-react";
import { formatDate, cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Message, Profile } from "@/types";

type AgentLite = Pick<
  Profile,
  "id" | "full_name" | "territory" | "last_active_at"
>;

const QUICK_REPLIES = [
  "Please share today's visit update.",
  "Great work today! 👏",
  "Please upload photos for your last visit.",
  "Call me when you are free.",
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

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return formatDate(d, "long");
}

export default function MessagesPage() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [selectedAgent, setSelectedAgent] = useState("");
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: agents = [] } = useQuery({
    queryKey: ["admin-agents-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, territory, last_active_at")
        .eq("role", "agent")
        .eq("status", "active")
        .order("full_name");
      if (error) throw error;
      return data as AgentLite[];
    },
  });

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["admin-messages", selectedAgent],
    queryFn: async () => {
      if (!selectedAgent || !profile) return [];
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .or(
          `and(sender_id.eq.${profile.id},receiver_id.eq.${selectedAgent}),and(sender_id.eq.${selectedAgent},receiver_id.eq.${profile.id})`,
        )
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Message[];
    },
    enabled: !!selectedAgent && !!profile,
    refetchInterval: 15000,
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!profile || !selectedAgent || !text.trim())
        throw new Error("Missing data");
      const { error } = await supabase.from("messages").insert({
        sender_id: profile.id,
        receiver_id: selectedAgent,
        message_text: text.trim(),
      });
      if (error) throw error;
      await supabase.from("audit_logs").insert({
        actor_id: profile.id,
        action: "send_message",
        entity_type: "message",
        entity_id: selectedAgent,
        metadata: { preview: text.trim().slice(0, 50) },
      });
    },
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["admin-messages", selectedAgent] });
      toast.success("Message sent");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const selected = agents.find((a) => a.id === selectedAgent);

  const filteredAgents = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return agents;
    return agents.filter(
      (a) =>
        a.full_name.toLowerCase().includes(term) ||
        (a.territory ?? "").toLowerCase().includes(term),
    );
  }, [agents, search]);

  // Group messages by day
  const grouped = useMemo(() => {
    const groups: { label: string; items: Message[] }[] = [];
    messages.forEach((m) => {
      const label = dayLabel(m.created_at);
      const last = groups[groups.length - 1];
      if (last && last.label === label) last.items.push(m);
      else groups.push({ label, items: [m] });
    });
    return groups;
  }, [messages]);

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, selectedAgent]);

  const lastMessage = messages[messages.length - 1];

  return (
    <div className="space-y-6">
      {/* ───────── Hero header ───────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-950 via-brand-800 to-brand-600 p-6 text-white shadow-lg sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gold-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-1/3 h-48 w-48 rounded-full bg-white/10 blur-3xl" />

        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-gold-300 ring-1 ring-inset ring-gold-400/30">
              <MessageSquare className="h-3.5 w-3.5" />
              Team Chat
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Messages
            </h1>
            <p className="mt-1 text-sm text-white/70">
              {selected
                ? `Chatting with ${selected.full_name}`
                : "Send instructions and updates to your promoters"}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <StatChip icon={Users} label="Promoters" value={agents.length} />
            {selected && messages.length > 0 && (
              <>
                <StatChip
                  icon={MessageSquare}
                  label="Messages"
                  value={messages.length}
                />
                <StatChip
                  icon={Clock}
                  label="Last message"
                  value={
                    lastMessage
                      ? formatDate(lastMessage.created_at, "time")
                      : "—"
                  }
                />
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        {/* ───────── Promoter list ───────── */}
        <div
          className={cn(
            "card flex h-[68vh] flex-col overflow-hidden",
            selectedAgent && "hidden lg:flex",
          )}
        >
          <div className="border-b border-slate-100 p-4">
            <div className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <Users className="h-3.5 w-3.5 text-brand-600" /> Promoters
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className="input pl-9"
                placeholder="Search promoter"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {filteredAgents.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-slate-400">
                No promoters found
              </p>
            ) : (
              filteredAgents.map((a) => {
                const active = selectedAgent === a.id;
                return (
                  <button
                    key={a.id}
                    onClick={() => setSelectedAgent(a.id)}
                    className={cn(
                      "mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                      active
                        ? "bg-brand-600 text-white shadow-md"
                        : "text-slate-700 hover:bg-brand-50",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                        active
                          ? "bg-gold-400 text-brand-950"
                          : "bg-gradient-to-br from-brand-600 to-brand-800 text-gold-300",
                      )}
                    >
                      {initials(a.full_name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">
                        {a.full_name}
                      </span>
                      <span
                        className={cn(
                          "flex items-center gap-1 truncate text-xs",
                          active ? "text-white/70" : "text-slate-400",
                        )}
                      >
                        {a.territory ? (
                          <>
                            <MapPin className="h-3 w-3 shrink-0" />
                            <span className="truncate">{a.territory}</span>
                          </>
                        ) : a.last_active_at ? (
                          `Active ${formatDate(a.last_active_at, "short")}`
                        ) : (
                          "Promoter"
                        )}
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ───────── Chat panel ───────── */}
        <div
          className={cn(
            "card flex h-[68vh] flex-col overflow-hidden",
            !selectedAgent && "hidden lg:flex",
          )}
        >
          {!selectedAgent ? (
            <div className="flex flex-1 flex-col items-center justify-center bg-gradient-to-b from-white to-brand-50/40 text-center">
              <div className="mb-4 rounded-full bg-brand-50 p-5 ring-8 ring-brand-50/50">
                <MessageSquare className="h-8 w-8 text-brand-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">
                Select a promoter
              </h3>
              <p className="mt-1 max-w-xs text-sm text-slate-500">
                Choose a promoter from the list to view or send messages.
              </p>
            </div>
          ) : (
            <>
              {/* chat header */}
              <div className="flex items-center gap-3 border-b border-slate-100 bg-white px-4 py-3">
                <button
                  onClick={() => setSelectedAgent("")}
                  className="rounded-full p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
                  title="Back"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-600 to-brand-800 text-sm font-bold text-gold-300">
                  {initials(selected?.full_name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {selected?.full_name}
                  </p>
                  <p className="truncate text-xs text-slate-400">
                    {selected?.territory
                      ? selected.territory
                      : selected?.last_active_at
                        ? `Last active ${formatDate(selected.last_active_at, "datetime")}`
                        : "Promoter"}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedAgent("")}
                  className="hidden rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 lg:block"
                  title="Close chat"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* messages */}
              <div className="flex-1 space-y-4 overflow-y-auto bg-gradient-to-b from-slate-50 to-brand-50/30 p-4 sm:p-5">
                {isLoading ? (
                  <div className="space-y-3">
                    {[60, 40, 70].map((w, i) => (
                      <div
                        key={i}
                        className={cn(
                          "h-12 animate-pulse rounded-2xl bg-slate-200/70",
                          i % 2 === 0 ? "" : "ml-auto",
                        )}
                        style={{ width: `${w}%` }}
                      />
                    ))}
                  </div>
                ) : messages.length === 0 ? (
                  <EmptyState
                    icon={MessageSquare}
                    title="No messages yet"
                    description={`Say hello to ${selected?.full_name ?? "your promoter"} to start the conversation.`}
                  />
                ) : (
                  grouped.map((g) => (
                    <div key={g.label} className="space-y-2">
                      <div className="flex justify-center">
                        <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400 shadow-sm ring-1 ring-slate-200">
                          {g.label}
                        </span>
                      </div>
                      {g.items.map((m) => {
                        const mine = m.sender_id === profile?.id;
                        return (
                          <div
                            key={m.id}
                            className={cn("flex", mine && "justify-end")}
                          >
                            <div
                              className={cn(
                                "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm sm:max-w-[70%]",
                                mine
                                  ? "rounded-br-md bg-gradient-to-br from-brand-600 to-brand-700 text-white"
                                  : "rounded-bl-md bg-white text-slate-800 ring-1 ring-slate-200",
                              )}
                            >
                              <p className="whitespace-pre-line break-words leading-relaxed">
                                {m.message_text}
                              </p>
                              <div
                                className={cn(
                                  "mt-1 flex items-center justify-end gap-1 text-[10px]",
                                  mine ? "text-white/70" : "text-slate-400",
                                )}
                              >
                                {formatDate(m.created_at, "time")}
                                {mine &&
                                  (m.is_read ? (
                                    <CheckCheck className="h-3.5 w-3.5 text-gold-300" />
                                  ) : (
                                    <Check className="h-3.5 w-3.5" />
                                  ))}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))
                )}
                <div ref={bottomRef} />
              </div>

              {/* composer */}
              <div className="border-t border-slate-100 bg-white p-3 sm:p-4">
                <div className="mb-2.5 flex gap-2 overflow-x-auto pb-1">
                  {QUICK_REPLIES.map((q) => (
                    <button
                      key={q}
                      onClick={() => setText(q)}
                      className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
                    >
                      {q}
                    </button>
                  ))}
                </div>
                <div className="flex items-end gap-2">
                  <textarea
                    rows={1}
                    className="input max-h-32 min-h-[44px] flex-1 resize-none"
                    placeholder="Type a message..."
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (text.trim() && !sendMutation.isPending)
                          sendMutation.mutate();
                      }
                    }}
                  />
                  <button
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-600 to-brand-800 text-white shadow-md transition hover:scale-105 hover:shadow-lg disabled:pointer-events-none disabled:opacity-50"
                    disabled={!text.trim() || sendMutation.isPending}
                    onClick={() => sendMutation.mutate()}
                    title="Send"
                  >
                    {sendMutation.isPending ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <p className="mt-1.5 text-[11px] text-slate-400">
                  Press Enter to send · Shift+Enter for a new line
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ───────── Small helper component ───────── */

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
    <div className="flex items-center gap-3 rounded-xl bg-white/10 px-4 py-2.5 ring-1 ring-inset ring-white/15 backdrop-blur-sm">
      <Icon className="h-5 w-5 text-gold-300" />
      <div>
        <p className="text-lg font-bold leading-none">{value}</p>
        <p className="mt-1 text-[11px] uppercase tracking-wide text-white/60">
          {label}
        </p>
      </div>
    </div>
  );
}
