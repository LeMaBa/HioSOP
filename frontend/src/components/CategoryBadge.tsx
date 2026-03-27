import clsx from "clsx";
import { SOPCategory } from "../api/sops";

const config: Record<SOPCategory, { label: string; color: string }> = {
  BRAND: { label: "Brand", color: "bg-red-100 text-red-700" },
  THL: { label: "Techn. Hilfe", color: "bg-orange-100 text-orange-700" },
  GEFAHRGUT: { label: "Gefahrgut", color: "bg-yellow-100 text-yellow-700" },
  MANV: { label: "MANV", color: "bg-purple-100 text-purple-700" },
  WASSER: { label: "Wasser", color: "bg-blue-100 text-blue-700" },
  ALLGEMEIN: { label: "Allgemein", color: "bg-gray-100 text-gray-700" },
};

export default function CategoryBadge({ category }: { category: SOPCategory }) {
  const { label, color } = config[category] ?? { label: category, color: "bg-gray-100 text-gray-700" };
  return (
    <span className={clsx("inline-flex items-center px-2 py-0.5 rounded text-xs font-medium", color)}>
      {label}
    </span>
  );
}
