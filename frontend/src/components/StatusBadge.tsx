import clsx from "clsx";
import { SOPStatus } from "../api/sops";

const config: Record<SOPStatus, { label: string; color: string }> = {
  DRAFT:     { label: "Entwurf",    color: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300" },
  IN_REVIEW: { label: "In Review",  color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  ACTIVE:    { label: "Aktiv",      color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  ARCHIVED:  { label: "Archiviert", color: "bg-slate-100 text-slate-500 dark:bg-slate-700/50 dark:text-slate-400" },
};

export default function StatusBadge({ status }: { status: SOPStatus }) {
  const { label, color } = config[status] ?? { label: status, color: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300" };
  return (
    <span className={clsx("inline-flex items-center px-2 py-0.5 rounded text-xs font-medium", color)}>
      {label}
    </span>
  );
}
