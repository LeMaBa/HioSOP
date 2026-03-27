import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  BookOpen, Star, Settings, Users, LogOut, Wifi, WifiOff,
  ChevronDown, ChevronRight, Moon, Sun, ScrollText,
} from "lucide-react";
import { useAuthStore, isAdmin, isOwner } from "../store/auth";
import { useQuery } from "@tanstack/react-query";
import { sopsApi } from "../api/sops";
import { categoriesApi } from "../api/categories";
import SearchBar from "./SearchBar";
import clsx from "clsx";

function useDarkMode() {
  const [dark, setDark] = useState(() =>
    document.documentElement.classList.contains("dark")
  );
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };
  return { dark, toggle };
}

export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { dark, toggle: toggleDark } = useDarkMode();

  const { data: allSops } = useQuery({
    queryKey: ["sops"],
    queryFn: () => sopsApi.list(),
  });

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: categoriesApi.list,
    staleTime: 5 * 60 * 1000,
  });

  const favorites = allSops?.filter((s) => s.is_favorite);

  const sopsByCategory = (() => {
    if (!allSops || !categories) return [];
    const grouped = new Map<string, typeof allSops>();
    for (const sop of allSops) {
      if (!grouped.has(sop.category)) grouped.set(sop.category, []);
      grouped.get(sop.category)!.push(sop);
    }
    return categories
      .filter((c) => grouped.has(c.key))
      .map((c) => ({ category: c, sops: grouped.get(c.key)! }));
  })();

  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set());
  const toggleCat = (key: string) =>
    setCollapsedCats((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      {/* Offline Banner */}
      {!isOnline && (
        <div className="bg-amber-500 text-white text-sm text-center py-1.5 flex items-center justify-center gap-2">
          <WifiOff size={14} />
          Offline – Nur zwischengespeicherte SOPs verfügbar
        </div>
      )}

      {/* Top Bar — Malteser Red */}
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

          {/* Wordmark */}
          <div className="flex items-center gap-2 whitespace-nowrap">
            <span className="font-extrabold text-lg tracking-tight">Malteser</span>
            <span className="hidden sm:inline text-primary-300 font-light text-lg">SOP-Navigator</span>
          </div>

          <div className="flex-1 mx-4">
            <SearchBar />
          </div>

          <div className="flex items-center gap-3">
            <div className="text-sm text-primary-200 whitespace-nowrap flex items-center gap-2">
              {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
              <span className="hidden sm:inline">{user?.full_name}</span>
            </div>
            {/* Dark mode toggle */}
            <button
              onClick={toggleDark}
              title={dark ? "Heller Modus" : "Dunkler Modus"}
              className="p-1.5 rounded-lg text-primary-200 hover:text-white hover:bg-primary-600 transition-colors"
            >
              {dark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
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
            "w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col",
            "transform transition-transform duration-200 md:translate-x-0",
            sidebarOpen ? "translate-x-0" : "-translate-x-full",
            "md:flex"
          )}
        >
          <nav className="flex-1 overflow-y-auto py-3 px-2">
            <SidebarLink to="/" icon={<BookOpen size={16} />} label="SOP-Bibliothek" onClick={() => setSidebarOpen(false)} />

            {/* Favorites */}
            {favorites && favorites.length > 0 && (
              <div className="mt-4">
                <p className="px-3 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">
                  Favoriten
                </p>
                {favorites.map((sop) => (
                  <SopLink key={sop.id} sop={sop} onNavigate={() => setSidebarOpen(false)}>
                    <Star size={12} className="text-amber-400 flex-shrink-0" />
                  </SopLink>
                ))}
              </div>
            )}

            {/* SOP Table of Contents grouped by category */}
            {sopsByCategory.length > 0 && (
              <div className="mt-4">
                <p className="px-3 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">
                  Inhaltsverzeichnis
                </p>
                {sopsByCategory.map(({ category, sops }) => {
                  const collapsed = collapsedCats.has(category.key);
                  return (
                    <div key={category.key}>
                      <button
                        onClick={() => toggleCat(category.key)}
                        className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 rounded transition-colors"
                      >
                        <span className="uppercase tracking-wide">{category.label}</span>
                        {collapsed
                          ? <ChevronRight size={12} />
                          : <ChevronDown size={12} />
                        }
                      </button>
                      {!collapsed && sops.map((sop) => (
                        <SopLink key={sop.id} sop={sop} onNavigate={() => setSidebarOpen(false)} />
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </nav>

          {/* Bottom nav — changelog + admin, always pinned above user footer */}
          <div className="px-2 pb-2 border-t border-gray-200 dark:border-gray-700 pt-2">
            <SidebarLink to="/changelog" icon={<ScrollText size={16} />} label="Änderungsprotokoll" onClick={() => setSidebarOpen(false)} />
            {isAdmin(user) && (
              <div className="mt-2">
                <p className="px-3 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">
                  Verwaltung
                </p>
                <SidebarLink to="/admin" icon={<Settings size={16} />} label="SOP-Verwaltung" onClick={() => setSidebarOpen(false)} />
                {isOwner(user) && (
                  <SidebarLink to="/users" icon={<Users size={16} />} label="Benutzerverwaltung" onClick={() => setSidebarOpen(false)} />
                )}
              </div>
            )}
          </div>

          <div className="border-t border-gray-200 dark:border-gray-700 p-3">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1 truncate">{user?.email}</div>
            <div className="text-xs text-gray-400 dark:text-gray-500 mb-2">{roleLabel(user?.role)}</div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 w-full"
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
            ? "bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400"
            : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
        )
      }
    >
      {icon}
      {label}
    </NavLink>
  );
}

function SopLink({
  sop, onNavigate, children,
}: {
  sop: { id: string; code: string; title: string };
  onNavigate: () => void;
  children?: React.ReactNode;
}) {
  return (
    <NavLink
      to={`/sop/${sop.code}`}
      onClick={onNavigate}
      className={({ isActive }) =>
        clsx(
          "flex items-center gap-2 px-3 py-1 rounded text-sm truncate",
          isActive
            ? "bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 font-medium"
            : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
        )
      }
    >
      {children}
      <span className="font-mono text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">{sop.code}</span>
      <span className="truncate">{sop.title}</span>
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
