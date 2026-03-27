import clsx from "clsx";
import { SOPStatus } from "../api/sops";

const config: Record<SOPStatus, { label: string; color: string }> = {
  DRAFT: { label: "Entwurf", color: "bg-gray-100 text-gray-600" },
  IN_REVIEW: { label: "In Review", color: "bg-amber-100 text-amber-700" },
  ACTIVE: { label: "Aktiv", color: "bg-green-100 text-green-700" },
  ARCHIVED: { label: "Archiviert", color: "bg-slate-100 text-slate-500" },
};

export default function StatusBadge({ status }: { status: SOPStatus }) {
  const { label, color } = config[status] ?? { label: status, color: "bg-gray-100 text-gray-600" };
  return (
    <span className={clsx("inline-flex items-center px-2 py-0.5 rounded text-xs font-medium", color)}>
      {label}
    </span>
  );
}
