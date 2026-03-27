import clsx from "clsx";
import { useQuery } from "@tanstack/react-query";
import { categoriesApi } from "../api/categories";

export default function CategoryBadge({ category }: { category: string }) {
  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: categoriesApi.list,
    staleTime: 5 * 60 * 1000,
  });

  const cat = categories?.find((c) => c.key === category);
  const label = cat?.label ?? category;
  const color = cat?.color ?? "bg-gray-100 text-gray-700";

  return (
    <span className={clsx("inline-flex items-center px-2 py-0.5 rounded text-xs font-medium", color)}>
      {label}
    </span>
  );
}
