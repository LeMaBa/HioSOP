import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../api/client";
import { UserResponse } from "../api/auth";
import { useAuthStore } from "../store/auth";
import { Users, Plus, Shield, ShieldCheck, User, KeyRound, Trash2, X, Copy, Check } from "lucide-react";

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

interface Credentials {
  full_name: string;
  username: string;
  email: string;
  password: string;
  email_sent: boolean;
}

function CredentialsModal({ creds, onClose }: { creds: Credentials; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  const text = `Malteser SOP-Navigator – Zugangsdaten\n\nName:      ${creds.full_name}\nBenutzer:  ${creds.username}\nE-Mail:    ${creds.email}\nPasswort:  ${creds.password}\n\nBitte Passwort nach erster Anmeldung ändern.`;

  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">Zugangsdaten</h2>
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X size={18} />
          </button>
        </div>

        {creds.email_sent ? (
          <div className="flex items-center gap-2 text-xs text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg px-3 py-2 mb-4">
            <Check size={13} />
            Zugangsdaten wurden per E-Mail an {creds.email} gesendet.
          </div>
        ) : (
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Das Passwort wurde zurückgesetzt. Bitte diese Zugangsdaten sicher an den Benutzer weitergeben.
          </p>
        )}

        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-2 font-mono text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400 dark:text-gray-500 text-xs">Name</span>
            <span className="text-gray-800 dark:text-gray-200">{creds.full_name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400 dark:text-gray-500 text-xs">Benutzername</span>
            <span className="text-gray-800 dark:text-gray-200">{creds.username}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400 dark:text-gray-500 text-xs">E-Mail</span>
            <span className="text-gray-800 dark:text-gray-200">{creds.email}</span>
          </div>
          <div className="flex justify-between items-center border-t border-gray-200 dark:border-gray-700 pt-2 mt-2">
            <span className="text-gray-400 dark:text-gray-500 text-xs">Passwort</span>
            <span className="text-primary-600 dark:text-primary-400 font-bold tracking-wider">{creds.password}</span>
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <button
            onClick={copy}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary-700 hover:bg-primary-800 text-white text-sm rounded-lg"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? "Kopiert!" : "In Zwischenablage kopieren"}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-200 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
}

const inputCls = "w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500";

export default function UsersPage() {
  const { user: me } = useAuthStore();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    username: "", email: "", full_name: "", role: "DISPATCHER" as UserRole, password: "",
  });
  const [formError, setFormError] = useState("");
  const [credentials, setCredentials] = useState<Credentials | null>(null);

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

  const resetPasswordMutation = useMutation({
    mutationFn: (id: string) =>
      apiClient.post<Credentials>(`/users/${id}/reset-password`).then((r) => r.data),
    onSuccess: (data) => setCredentials(data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/users/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });

  return (
    <div className="max-w-3xl">
      {credentials && (
        <CredentialsModal creds={credentials} onClose={() => setCredentials(null)} />
      )}

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
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
          className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 mb-6 space-y-4"
        >
          <h2 className="font-medium text-gray-800 dark:text-gray-200">Neuen Benutzer anlegen</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Benutzername *</label>
              <input required value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Rolle *</label>
              <select value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as UserRole }))}
                className={inputCls}
              >
                {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Vollständiger Name *</label>
              <input required value={form.full_name}
                onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">E-Mail *</label>
              <input required type="email" value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className={inputCls}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Passwort *</label>
              <input required type="password" value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                className={inputCls}
              />
            </div>
          </div>
          {formError && (
            <div className="text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
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
              className="px-4 py-2 border border-gray-200 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Abbrechen
            </button>
          </div>
        </form>
      )}

      {isLoading && (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => <div key={i} className="h-14 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />)}
        </div>
      )}

      {users && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Benutzer</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300 hidden sm:table-cell">E-Mail</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Rolle</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-800 dark:text-gray-200">{u.full_name}</div>
                    <div className="text-xs text-gray-400 dark:text-gray-500 font-mono">{u.username}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 hidden sm:table-cell">{u.email}</td>
                  <td className="px-4 py-3">
                    {u.id === me?.id ? (
                      <span className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                        {ROLE_ICONS[u.role]}
                        {ROLE_LABELS[u.role]}
                      </span>
                    ) : (
                      <select
                        value={u.role}
                        onChange={(e) => updateRoleMutation.mutate({ id: u.id, role: e.target.value as UserRole })}
                        className="border border-gray-200 dark:border-gray-600 rounded px-2 py-1 text-xs bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none"
                      >
                        {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => (
                          <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {u.id !== me?.id ? (
                      <button
                        onClick={() => toggleActiveMutation.mutate({ id: u.id, is_active: !u.is_active })}
                        className={`text-xs px-2 py-1 rounded font-medium ${
                          u.is_active
                            ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50"
                            : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"
                        }`}
                      >
                        {u.is_active ? "Aktiv" : "Inaktiv"}
                      </button>
                    ) : (
                      <span className="text-xs text-green-600 dark:text-green-400 font-medium">Aktiv (ich)</span>
                    )}
                  </td>
                  {/* Actions */}
                  <td className="px-4 py-3">
                    {u.id !== me?.id && (
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => resetPasswordMutation.mutate(u.id)}
                          disabled={resetPasswordMutation.isPending}
                          title="Passwort zurücksetzen / Zugangsdaten senden"
                          className="p-1.5 rounded-lg text-gray-400 dark:text-gray-500 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-40"
                        >
                          <KeyRound size={14} />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Benutzer „${u.full_name}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`))
                              deleteMutation.mutate(u.id);
                          }}
                          disabled={deleteMutation.isPending}
                          title="Benutzer löschen"
                          className="p-1.5 rounded-lg text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-40"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
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
