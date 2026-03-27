import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { sopsApi } from "../api/sops";
import { categoriesApi } from "../api/categories";
import CategoryBadge from "../components/CategoryBadge";
import StatusBadge from "../components/StatusBadge";
import { Star, BookOpen, ChevronRight, FileDown } from "lucide-react";
import clsx from "clsx";

export default function LibraryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [category, setCategory] = useState<string>("ALL");
  const [activeTag, setActiveTag] = useState<string | null>(searchParams.get("tag"));

  useEffect(() => {
    const tag = searchParams.get("tag");
    if (tag) { setActiveTag(tag); setSearchParams({}, { replace: true }); }
  }, []);

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: categoriesApi.list,
    staleTime: 5 * 60 * 1000,
  });

  const { data: sops, isLoading, error } = useQuery({
    queryKey: ["sops", category, activeTag],
    queryFn: () =>
      sopsApi.list({
        ...(category !== "ALL" ? { category } : {}),
        ...(activeTag ? { tag: activeTag } : {}),
      }),
  });

  const handleTagClick = (tag: string, e: React.MouseEvent) => {
    e.preventDefault();
    setActiveTag((prev) => (prev === tag ? null : tag));
  };

  const [exporting, setExporting] = useState(false);
  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await sopsApi.exportPdf(category !== "ALL" ? { category } : undefined);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sop-export-${new Date().toISOString().slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-4">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <BookOpen size={22} />
          SOP-Bibliothek
        </h1>
        <button
          onClick={handleExport}
          disabled={exporting || isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
          title={category !== "ALL" ? `Kategorie "${category}" als PDF exportieren` : "Alle SOPs als PDF exportieren"}
        >
          <FileDown size={15} />
          {exporting ? "Exportiere…" : "PDF Export"}
        </button>
      </div>

      {/* Category Filter Chips */}
      <div className="flex flex-wrap gap-2 mb-6">
        {[{ key: "ALL", label: "Alle" }, ...(categories ?? [])].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setCategory(key)}
            className={clsx(
              "px-3 py-1.5 rounded-full text-sm font-medium border transition-colors",
              category === key
                ? "bg-primary-700 text-white border-primary-700"
                : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-primary-400"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Active tag filter indicator */}
      {activeTag && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm text-gray-500 dark:text-gray-400">Tag-Filter:</span>
          <button
            onClick={() => setActiveTag(null)}
            className="flex items-center gap-1 px-2 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 rounded-full text-xs font-medium hover:bg-primary-200 dark:hover:bg-primary-900/50"
          >
            #{activeTag} ✕
          </button>
        </div>
      )}

      {isLoading && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg p-4 text-sm">
          Fehler beim Laden der SOPs. Bitte Seite neu laden.
        </div>
      )}

      {!isLoading && sops?.length === 0 && (
        <div className="text-center py-16 text-gray-400 dark:text-gray-500">
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
              className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:border-primary-400 hover:shadow-sm transition-all group"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                    {sop.code}
                  </span>
                  <CategoryBadge category={sop.category} />
                  {sop.status && <StatusBadge status={sop.status} />}
                </div>
                {sop.is_favorite && (
                  <Star size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
                )}
              </div>

              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 group-hover:text-primary-700 dark:group-hover:text-primary-400 leading-snug mb-2">
                {sop.title}
              </h3>

              {sop.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {sop.tags.map((tag) => (
                    <button
                      key={tag}
                      onClick={(e) => handleTagClick(tag, e)}
                      className={clsx(
                        "px-1.5 py-0.5 rounded text-xs transition-colors",
                        activeTag === tag
                          ? "bg-primary-600 text-white"
                          : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-primary-100 dark:hover:bg-primary-900/30 hover:text-primary-700 dark:hover:text-primary-400"
                      )}
                    >
                      #{tag}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {sop.version_number ? `v${sop.version_number}` : "–"}
                  {sop.released_at &&
                    ` · ${new Date(sop.released_at).toLocaleDateString("de-DE")}`}
                </span>
                <ChevronRight size={14} className="text-gray-300 dark:text-gray-600 group-hover:text-primary-500" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
