import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/auth";
import { authApi } from "../api/auth";
import { ShieldCheck, LogIn } from "lucide-react";

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await authApi.login({ username, password });
      setAuth(data.access_token, data.user);
      navigate("/", { replace: true });
    } catch (err: any) {
      setError(
        err.response?.data?.detail || "Anmeldung fehlgeschlagen. Bitte erneut versuchen."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-800 to-primary-600 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="flex flex-col items-center mb-8">
            <div className="bg-primary-100 p-4 rounded-full mb-4">
              <ShieldCheck size={36} className="text-primary-700" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">SOP-Navigator</h1>
            <p className="text-gray-500 text-sm mt-1">Feuerwehrleitstelle</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                Benutzername
              </label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                autoFocus
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="benutzername"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Passwort
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-primary-700 hover:bg-primary-800 disabled:opacity-60 text-white font-medium py-2.5 rounded-lg transition-colors"
            >
              {loading ? (
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              ) : (
                <LogIn size={16} />
              )}
              {loading ? "Anmelden…" : "Anmelden"}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-gray-400">
            SOP-Navigator v0.1 · Nur für interne Nutzung
          </p>
        </div>
      </div>
    </div>
  );
}
