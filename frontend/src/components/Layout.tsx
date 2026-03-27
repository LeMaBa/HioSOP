import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  BookOpen, Star, Settings, Users, LogOut, Wifi, WifiOff, ChevronRight
} from "lucide-react";
import { useAuthStore, isAdmin, isOwner } from "../store/auth";
import { useQuery } from "@tanstack/react-query";
import { sopsApi } from "../api/sops";
import SearchBar from "./SearchBar";
import clsx from "clsx";

export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { data: favorites } = useQuery({
    queryKey: ["sops", "favorites"],
    queryFn: () => sopsApi.list(),
    select: (data) => data.filter((s) => s.is_favorite),
  });

  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Offline Banner */}
      {!isOnline && (
        <div className="bg-amber-500 text-white text-sm text-center py-1.5 flex items-center justify-center gap-2">
          <WifiOff size={14} />
          Offline – Nur zwischengespeicherte SOPs verfügbar
        </div>
      )}

      {/* Top Bar */}
      <header className="bg-primary-700 text-white shadow-md flex-shrink-0">
        <div className="flex items-center h-14 px-4 gap-3">
          {/* Mobile menu toggle */}
          <button
            className="md:hidden text-white p-1 rounded"
            onClick={() => setSidebarOpen((o) => !o)}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <span className="font-bold text-lg tracking-tight whitespace-nowrap">SOP-Navigator</span>

          <div className="flex-1 mx-4">
            <SearchBar />
          </div>

          <div className="flex items-center gap-2 text-sm text-primary-200 whitespace-nowrap">
            {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
            <span className="hidden sm:inline">{user?.full_name}</span>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar Overlay (mobile) */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/40 z-20 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={clsx(
            "fixed md:static inset-y-0 left-0 z-30 md:z-auto",
            "w-64 bg-white border-r border-gray-200 flex flex-col",
            "transform transition-transform duration-200 md:translate-x-0",
            sidebarOpen ? "translate-x-0" : "-translate-x-full",
            "md:flex"
          )}
        >
          <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
            <SidebarLink to="/" icon={<BookOpen size={18} />} label="SOP-Bibliothek" onClick={() => setSidebarOpen(false)} />

            {favorites && favorites.length > 0 && (
              <div className="pt-4">
                <p className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                  Favoriten
                </p>
                {favorites.map((sop) => (
                  <NavLink
                    key={sop.id}
                    to={`/sop/${sop.code}`}
                    onClick={() => setSidebarOpen(false)}
                    className={({ isActive }) =>
                      clsx(
                        "flex items-center gap-2 px-3 py-1.5 rounded text-sm truncate",
                        isActive
                          ? "bg-primary-50 text-primary-700 font-medium"
                          : "text-gray-600 hover:bg-gray-100"
                      )
                    }
                  >
                    <Star size={14} className="text-amber-400 flex-shrink-0" />
                    <span className="truncate">{sop.code} – {sop.title}</span>
                  </NavLink>
                ))}
              </div>
            )}

            {isAdmin(user) && (
              <div className="pt-4">
                <p className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                  Verwaltung
                </p>
                <SidebarLink to="/admin" icon={<Settings size={18} />} label="SOP-Verwaltung" onClick={() => setSidebarOpen(false)} />
                {isOwner(user) && (
                  <SidebarLink to="/users" icon={<Users size={18} />} label="Benutzerverwaltung" onClick={() => setSidebarOpen(false)} />
                )}
              </div>
            )}
          </nav>

          <div className="border-t border-gray-200 p-3">
            <div className="text-xs text-gray-500 mb-1 truncate">{user?.email}</div>
            <div className="text-xs text-gray-400 mb-2">{roleLabel(user?.role)}</div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-red-600 w-full"
            >
              <LogOut size={16} />
              Abmelden
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function SidebarLink({
  to, icon, label, onClick,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}) {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      onClick={onClick}
      className={({ isActive }) =>
        clsx(
          "flex items-center gap-2 px-3 py-2 rounded text-sm font-medium",
          isActive
            ? "bg-primary-50 text-primary-700"
            : "text-gray-700 hover:bg-gray-100"
        )
      }
    >
      {icon}
      {label}
    </NavLink>
  );
}

function roleLabel(role?: string) {
  switch (role) {
    case "OWNER": return "Leitstellenleiter";
    case "ADMIN": return "Admin / Ersteller";
    default: return "Disponent";
  }
}
