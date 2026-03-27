import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { sopsApi } from "../api/sops";

export default function SearchBar() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Ctrl+K / Cmd+K to focus
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (e.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Click outside to close
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const { data: results } = useQuery({
    queryKey: ["search", query],
    queryFn: () => sopsApi.list({ q: query }),
    enabled: query.length >= 2,
    staleTime: 1000 * 30,
  });

  const handleSelect = (code: string) => {
    navigate(`/sop/${code}`);
    setOpen(false);
    setQuery("");
  };

  return (
    <div ref={ref} className="relative w-full max-w-xl">
      <div className="flex items-center bg-primary-600 rounded px-3 gap-2">
        <Search size={16} className="text-primary-300 flex-shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="SOP suchen… (Strg+K)"
          className="flex-1 bg-transparent text-white placeholder-primary-300 py-2 text-sm outline-none min-w-0"
        />
        {query && (
          <button onClick={() => setQuery("")}>
            <X size={14} className="text-primary-300 hover:text-white" />
          </button>
        )}
        <kbd className="hidden sm:inline-block text-xs text-primary-400 border border-primary-500 rounded px-1">
          Strg+K
        </kbd>
      </div>

      {open && results && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 max-h-80 overflow-y-auto z-50">
          {results.slice(0, 10).map((sop) => (
            <button
              key={sop.id}
              className="w-full text-left px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3 border-b border-gray-100 dark:border-gray-700 last:border-0"
              onClick={() => handleSelect(sop.code)}
            >
              <span className="text-xs font-mono bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded">
                {sop.code}
              </span>
              <span className="text-sm text-gray-800 dark:text-gray-200 flex-1 truncate">{sop.title}</span>
              <span className="text-xs text-gray-400 dark:text-gray-500">{categoryLabel(sop.category)}</span>
            </button>
          ))}
        </div>
      )}

      {open && query.length >= 2 && results?.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 px-4 py-3 text-sm text-gray-500 dark:text-gray-400 z-50">
          Keine SOPs gefunden
        </div>
      )}
    </div>
  );
}

function categoryLabel(cat: string) {
  const labels: Record<string, string> = {
    BRAND: "Brand",
    THL: "Techn. Hilfe",
    GEFAHRGUT: "Gefahrgut",
    MANV: "MANV",
    WASSER: "Wasser",
    ALLGEMEIN: "Allgemein",
  };
  return labels[cat] ?? cat;
}
