import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { Users, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import type { Profile } from "@/types";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

/**
 * Create a new promoter (Supabase Auth user + profile) or update an existing one by email.
 * New users are created with a throwaway, non-persisting client so the admin's own
 * session is never replaced.
 */
const linkSchema = z.object({
  email: z.string().email(),
  full_name: z.string().min(2),
  phone: z.string().optional(),
  password: z
    .string()
    .optional()
    .refine(
      (v) => !v || v.length >= 6,
      "Password must be at least 6 characters",
    ),
});

type LinkForm = z.infer<typeof linkSchema>;

export default function AgentList() {
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const qc = useQueryClient();

  const { data: agents = [], isLoading } = useQuery({
    queryKey: ["admin-agents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("role", "agent")
        .order("full_name");
      if (error) throw error;
      return data as Profile[];
    },
  });

  const filtered = agents.filter(
    (a) =>
      a.full_name.toLowerCase().includes(search.toLowerCase()) ||
      a.email.toLowerCase().includes(search.toLowerCase()),
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<LinkForm>({ resolver: zodResolver(linkSchema) });

  const updateMutation = useMutation({
    mutationFn: async (form: LinkForm) => {
      const email = form.email.trim().toLowerCase();

      const findProfile = async () => {
        const { data, error } = await supabase
          .from("profiles")
          .select("id")
          .ilike("email", email)
          .maybeSingle();
        if (error) throw error;
        return data;
      };

      let existing = await findProfile();

      if (!existing) {
        if (!form.password) {
          throw new Error(
            "No promoter found with that email. Enter a password (min 6 characters) to create a new promoter.",
          );
        }
        // Separate client: does not persist/replace the admin session.
        const tempClient = createClient(
          import.meta.env.VITE_SUPABASE_URL as string,
          import.meta.env.VITE_SUPABASE_ANON_KEY as string,
          {
            auth: {
              persistSession: false,
              autoRefreshToken: false,
              detectSessionInUrl: false,
            },
          },
        );
        const { error: signUpErr } = await tempClient.auth.signUp({
          email,
          password: form.password,
          options: { data: { role: "agent", full_name: form.full_name } },
        });
        if (signUpErr) throw signUpErr;

        existing = await findProfile();
        if (!existing) {
          throw new Error(
            "User was created but the profile was not found. Check the handle_new_user trigger in Supabase.",
          );
        }
      }

      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: form.full_name,
          phone: form.phone || null,
          role: "agent",
          status: "active",
          joining_date: new Date().toISOString().split("T")[0],
        })
        .eq("id", existing.id);

      if (error) throw error;

      await supabase.from("audit_logs").insert({
        actor_id: (await supabase.auth.getUser()).data.user?.id,
        action: "update_agent_profile",
        entity_type: "profile",
        entity_id: existing.id,
        metadata: { email: form.email, name: form.full_name },
      });
    },
    onSuccess: () => {
      toast.success("Promoter saved");
      setShowCreate(false);
      reset();
      qc.invalidateQueries({ queryKey: ["admin-agents"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const newStatus = status === "active" ? "inactive" : "active";
      const { error } = await supabase
        .from("profiles")
        .update({ status: newStatus })
        .eq("id", id);
      if (error) throw error;
      await supabase.from("audit_logs").insert({
        actor_id: (await supabase.auth.getUser()).data.user?.id,
        action: newStatus === "active" ? "activate_agent" : "deactivate_agent",
        entity_type: "profile",
        entity_id: id,
      });
    },
    onSuccess: () => {
      toast.success("Status updated");
      qc.invalidateQueries({ queryKey: ["admin-agents"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Promoters</h1>
          <p className="text-sm text-slate-500">{agents.length} total</p>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() => setShowCreate(true)}
        >
          <Plus className="h-4 w-4" /> Manage Promoter
        </button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          className="input pl-9"
          placeholder="Search promoters..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card h-16 animate-pulse bg-slate-100" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No promoters found"
          description="Click “Manage Promoter” to add your first promoter."
        />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-left text-slate-500">
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr
                  key={a.id}
                  className="border-b border-slate-50 hover:bg-slate-50"
                >
                  <td className="px-5 py-3">
                    <Link
                      to={`/admin/agents/${a.id}`}
                      className="font-medium text-brand-700 hover:underline"
                    >
                      {a.full_name}
                    </Link>
                    <p className="text-xs text-slate-400">{a.email}</p>
                  </td>
                  <td className="px-5 py-3">
                    <StatusBadge status={a.status} />
                  </td>
                  <td className="px-5 py-3">
                    <button
                      type="button"
                      className="btn-ghost text-xs"
                      onClick={() =>
                        toggleStatus.mutate({ id: a.id, status: a.status })
                      }
                    >
                      {a.status === "active" ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card w-full max-w-md p-6">
            <h2 className="mb-2 text-lg font-semibold">
              Add / Update Promoter
            </h2>
            <p className="mb-4 text-xs text-slate-500">
              Enter the promoter&apos;s details and a password to create a new
              login. If the email already exists, the details are updated and
              the password can be left blank.
            </p>
            <form
              onSubmit={handleSubmit((d) => updateMutation.mutate(d))}
              className="space-y-3"
            >
              <div>
                <label className="label">Email *</label>
                <input className="input" type="email" {...register("email")} />
                {errors.email && (
                  <p className="text-xs text-red-600">{errors.email.message}</p>
                )}
              </div>
              <div>
                <label className="label">Full Name *</label>
                <input className="input" {...register("full_name")} />
                {errors.full_name && (
                  <p className="text-xs text-red-600">
                    {errors.full_name.message}
                  </p>
                )}
              </div>
              <div>
                <label className="label">Phone</label>
                <input className="input" {...register("phone")} />
              </div>
              <div>
                <label className="label">Password</label>
                <input
                  className="input"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Required only for a new promoter"
                  {...register("password")}
                />
                {errors.password && (
                  <p className="text-xs text-red-600">
                    {errors.password.message}
                  </p>
                )}
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="btn-primary flex-1"
                  disabled={updateMutation.isPending}
                >
                  {updateMutation.isPending ? "Saving..." : "Save"}
                </button>
                <button
                  type="button"
                  className="btn-secondary flex-1"
                  onClick={() => setShowCreate(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
