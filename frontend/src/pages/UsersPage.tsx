import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../api/client";
import { UserResponse } from "../api/auth";
import { useAuthStore } from "../store/auth";
import { Users, Plus, Shield, ShieldCheck, User } from "lucide-react";

type UserRole = "DISPATCHER" | "ADMIN" | "OWNER";

const ROLE_LABELS: Record<UserRole, string> = {
  DISPATCHER: "Disponent",
  ADMIN: "Admin / Ersteller",
  OWNER: "Leitstellenleiter",
};

const ROLE_ICONS: Record<UserRole, React.ReactNode> = {
  DISPATCHER: <User size={14} />,
  ADMIN: <Shield size={14} />,
  OWNER: <ShieldCheck size={14} />,
};

export default function UsersPage() {
  const { user: me } = useAuthStore();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    username: "", email: "", full_name: "", role: "DISPATCHER" as UserRole, password: "",
  });
  const [formError, setFormError] = useState("");

  const { data: users, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => apiClient.get<UserResponse[]>("/users").then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof form) => apiClient.post<UserResponse>("/users", data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      setShowForm(false);
      setForm({ username: "", email: "", full_name: "", role: "DISPATCHER", password: "" });
    },
    onError: (e: any) => setFormError(e.response?.data?.detail || "Fehler"),
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: UserRole }) =>
      apiClient.patch(`/users/${id}`, { role }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      apiClient.patch(`/users/${id}`, { is_active }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
          <Users size={22} />
          Benutzerverwaltung
        </h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 px-4 py-2 bg-primary-700 hover:bg-primary-800 text-white text-sm font-medium rounded-lg"
        >
          <Plus size={16} />
          Neuer Benutzer
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={(e) => { e.preventDefault(); setFormError(""); createMutation.mutate(form); }}
          className="bg-white rounded-xl border border-gray-200 p-5 mb-6 space-y-4"
        >
          <h2 className="font-medium text-gray-800">Neuen Benutzer anlegen</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Benutzername *</label>
              <input required value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Rolle *</label>
              <select value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as UserRole }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Vollständiger Name *</label>
              <input required value={form.full_name}
                onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">E-Mail *</label>
              <input required type="email" value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Passwort *</label>
              <input required type="password" value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
          {formError && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {formError}
            </div>
          )}
          <div className="flex gap-2">
            <button type="submit" disabled={createMutation.isPending}
              className="px-4 py-2 bg-primary-700 hover:bg-primary-800 text-white text-sm rounded-lg disabled:opacity-60"
            >
              {createMutation.isPending ? "Wird angelegt…" : "Anlegen"}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="px-4 py-2 border border-gray-200 text-sm text-gray-600 rounded-lg hover:bg-gray-50"
            >
              Abbrechen
            </button>
          </div>
        </form>
      )}

      {isLoading && (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />)}
        </div>
      )}

      {users && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Benutzer</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">E-Mail</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Rolle</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-800">{u.full_name}</div>
                    <div className="text-xs text-gray-400 font-mono">{u.username}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{u.email}</td>
                  <td className="px-4 py-3">
                    {u.id === me?.id ? (
                      <span className="flex items-center gap-1 text-gray-600">
                        {ROLE_ICONS[u.role]}
                        {ROLE_LABELS[u.role]}
                      </span>
                    ) : (
                      <select
                        value={u.role}
                        onChange={(e) => updateRoleMutation.mutate({ id: u.id, role: e.target.value as UserRole })}
                        className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none"
                      >
                        {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => (
                          <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {u.id !== me?.id && (
                      <button
                        onClick={() => toggleActiveMutation.mutate({ id: u.id, is_active: !u.is_active })}
                        className={`text-xs px-2 py-1 rounded font-medium ${u.is_active ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
                      >
                        {u.is_active ? "Aktiv" : "Inaktiv"}
                      </button>
                    )}
                    {u.id === me?.id && (
                      <span className="text-xs text-green-600 font-medium">Aktiv (ich)</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
