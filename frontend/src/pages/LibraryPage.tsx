import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { sopsApi, SOPCategory } from "../api/sops";
import CategoryBadge from "../components/CategoryBadge";
import StatusBadge from "../components/StatusBadge";
import { Star, BookOpen, ChevronRight } from "lucide-react";
import clsx from "clsx";

const CATEGORIES: { key: SOPCategory | "ALL"; label: string }[] = [
  { key: "ALL", label: "Alle" },
  { key: "BRAND", label: "Brand" },
  { key: "THL", label: "Techn. Hilfe" },
  { key: "GEFAHRGUT", label: "Gefahrgut" },
  { key: "MANV", label: "MANV" },
  { key: "WASSER", label: "Wasser" },
  { key: "ALLGEMEIN", label: "Allgemein" },
];

export default function LibraryPage() {
  const [category, setCategory] = useState<SOPCategory | "ALL">("ALL");

  const { data: sops, isLoading, error } = useQuery({
    queryKey: ["sops", category],
    queryFn: () =>
      sopsApi.list(category !== "ALL" ? { category } : undefined),
  });

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <BookOpen size={22} />
        SOP-Bibliothek
      </h1>

      {/* Category Filter Chips */}
      <div className="flex flex-wrap gap-2 mb-6">
        {CATEGORIES.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setCategory(key)}
            className={clsx(
              "px-3 py-1.5 rounded-full text-sm font-medium border transition-colors",
              category === key
                ? "bg-primary-700 text-white border-primary-700"
                : "bg-white text-gray-600 border-gray-300 hover:border-primary-400"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
          Fehler beim Laden der SOPs. Bitte Seite neu laden.
        </div>
      )}

      {!isLoading && sops?.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <BookOpen size={40} className="mx-auto mb-3 opacity-30" />
          <p>Keine SOPs in dieser Kategorie</p>
        </div>
      )}

      {sops && sops.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sops.map((sop) => (
            <Link
              key={sop.id}
              to={`/sop/${sop.code}`}
              className="bg-white rounded-lg border border-gray-200 p-4 hover:border-primary-400 hover:shadow-sm transition-all group"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs font-semibold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                    {sop.code}
                  </span>
                  <CategoryBadge category={sop.category} />
                  {sop.status && <StatusBadge status={sop.status} />}
                </div>
                {sop.is_favorite && (
                  <Star size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
                )}
              </div>

              <h3 className="text-sm font-medium text-gray-900 group-hover:text-primary-700 leading-snug mb-2">
                {sop.title}
              </h3>

              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">
                  {sop.version_number ? `v${sop.version_number}` : "–"}
                  {sop.released_at &&
                    ` · ${new Date(sop.released_at).toLocaleDateString("de-DE")}`}
                </span>
                <ChevronRight size={14} className="text-gray-300 group-hover:text-primary-500" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
