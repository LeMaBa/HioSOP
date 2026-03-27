import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { changelogApi, ChangelogEntry } from "../api/changelog";
import { AlertCircle, Clock, CheckCheck } from "lucide-react";
import CategoryBadge from "../components/CategoryBadge";

function groupByDate(entries: ChangelogEntry[]): [string, ChangelogEntry[]][] {
  const map = new Map<string, ChangelogEntry[]>();
  for (const entry of entries) {
    const day = new Date(entry.timestamp).toLocaleDateString("de-DE", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });
    if (!map.has(day)) map.set(day, []);
    map.get(day)!.push(entry);
  }
  return Array.from(map.entries());
}

const PAGE_SIZE = 50;

export default function ChangelogPage() {
  const [page, setPage] = useState(0);

  const { data: entries, isLoading, error } = useQuery({
    queryKey: ["changelog", page],
    queryFn: () => changelogApi.list({ skip: page * PAGE_SIZE, limit: PAGE_SIZE }),
  });

  const grouped = entries ? groupByDate(entries) : [];
  const hasMore = (entries?.length ?? 0) === PAGE_SIZE;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Änderungsprotokoll</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Alle freigegebenen SOP-Versionen, sortiert nach Datum.
        </p>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle size={18} />
          Fehler beim Laden des Änderungsprotokolls.
        </div>
      )}

      {!isLoading && !error && grouped.length === 0 && (
        <div className="text-center py-16 text-gray-400 dark:text-gray-500">
          <Clock size={40} className="mx-auto mb-3 opacity-30" />
          <p>Noch keine freigegebenen SOPs.</p>
        </div>
      )}

      {grouped.map(([day, dayEntries]) => (
        <div key={day}>
          {/* Day separator */}
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider whitespace-nowrap">
              {day}
            </span>
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
          </div>

          <div className="space-y-2">
            {dayEntries.map((entry) => (
              <div
                key={entry.id}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4"
              >
                <div className="flex items-start gap-3">
                  {/* Released icon */}
                  <div className="mt-0.5 flex-shrink-0 w-7 h-7 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <CheckCheck size={14} className="text-green-600 dark:text-green-400" />
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* SOP title row */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {entry.sop_code ? (
                        <Link
                          to={`/sop/${entry.sop_code}`}
                          className="font-semibold text-gray-900 dark:text-gray-100 hover:text-primary-600 dark:hover:text-primary-400"
                        >
                          {entry.sop_code} – {entry.sop_title}
                        </Link>
                      ) : (
                        <span className="font-semibold text-gray-500 dark:text-gray-400">Unbekannte SOP</span>
                      )}
                      {entry.version_number && (
                        <span className="font-mono text-xs text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                          v{entry.version_number}
                        </span>
                      )}
                      {entry.sop_category && <CategoryBadge category={entry.sop_category} />}
                    </div>

                    {/* Change comment */}
                    {entry.change_comment ? (
                      <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                        {entry.change_comment}
                      </p>
                    ) : (
                      <p className="mt-1 text-sm text-gray-400 dark:text-gray-500 italic">
                        Kein Änderungskommentar angegeben.
                      </p>
                    )}

                    {/* Meta */}
                    <div className="mt-1.5 flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500">
                      <span>
                        {new Date(entry.timestamp).toLocaleTimeString("de-DE", {
                          hour: "2-digit", minute: "2-digit",
                        })} Uhr
                      </span>
                      <span>·</span>
                      <span>Freigegeben von {entry.username}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Pagination */}
      {(page > 0 || hasMore) && (
        <div className="flex justify-between items-center pt-2">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40"
          >
            ← Neuer
          </button>
          <span className="text-xs text-gray-400 dark:text-gray-500">Seite {page + 1}</span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={!hasMore}
            className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40"
          >
            Älter →
          </button>
        </div>
      )}
    </div>
  );
}
