import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { EmptyState } from "@/components/shared/EmptyState";
import { MessageSquare, Send } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";
import type { Message, Profile } from "@/types";

export default function MessagesPage() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [selectedAgent, setSelectedAgent] = useState("");
  const [text, setText] = useState("");

  const { data: agents = [] } = useQuery({
    queryKey: ["admin-agents-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("role", "agent")
        .eq("status", "active")
        .order("full_name");
      if (error) throw error;
      return data as Pick<Profile, "id" | "full_name">[];
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

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Messages</h1>
        <p className="text-sm text-slate-500">Send messages to promoters</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
        <div className="card max-h-[70vh] overflow-y-auto">
          <div className="border-b border-slate-100 px-4 py-3 text-sm font-medium text-slate-500">
            Promoters
          </div>
          {agents.map((a) => (
            <button
              key={a.id}
              className={`flex w-full items-center gap-2 px-4 py-3 text-left text-sm hover:bg-slate-50 ${
                selectedAgent === a.id
                  ? "bg-brand-50 text-brand-700"
                  : "text-slate-700"
              }`}
              onClick={() => setSelectedAgent(a.id)}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold">
                {a.full_name.charAt(0)}
              </div>
              {a.full_name}
            </button>
          ))}
        </div>

        <div className="card flex flex-col" style={{ minHeight: 400 }}>
          {!selectedAgent ? (
            <div className="flex flex-1 items-center justify-center">
              <EmptyState
                icon={MessageSquare}
                title="Select an promoter"
                description="Choose an promoter from the list to view or send messages."
              />
            </div>
          ) : (
            <>
              <div className="border-b border-slate-100 px-4 py-3 font-medium">
                {agents.find((a) => a.id === selectedAgent)?.full_name}
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {isLoading ? (
                  <p className="text-center text-sm text-slate-400">
                    Loading...
                  </p>
                ) : messages.length === 0 ? (
                  <p className="text-center text-sm text-slate-400">
                    No messages yet
                  </p>
                ) : (
                  messages.map((m) => (
                    <div
                      key={m.id}
                      className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                        m.sender_id === profile?.id
                          ? "ml-auto bg-brand-600 text-white"
                          : "bg-slate-100 text-slate-800"
                      }`}
                    >
                      <p>{m.message_text}</p>
                      <p
                        className={`mt-1 text-[10px] ${
                          m.sender_id === profile?.id
                            ? "text-brand-200"
                            : "text-slate-400"
                        }`}
                      >
                        {formatDate(m.created_at, "datetime")}
                      </p>
                    </div>
                  ))
                )}
              </div>
              <div className="flex gap-2 border-t border-slate-100 p-3">
                <input
                  className="input flex-1"
                  placeholder="Type a message..."
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMutation.mutate();
                    }
                  }}
                />
                <button
                  className="btn-primary"
                  disabled={!text.trim() || sendMutation.isPending}
                  onClick={() => sendMutation.mutate()}
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
