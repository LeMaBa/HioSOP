import { Link } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";

interface Crumb {
  label: string;
  href?: string;
}

interface Props {
  crumbs: Crumb[];
}

export default function Breadcrumb({ crumbs }: Props) {
  return (
    <nav className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 flex-wrap">
      <Link to="/" className="hover:text-primary-600 dark:hover:text-primary-400 flex items-center">
        <Home size={14} />
      </Link>
      {crumbs.map((crumb, i) => (
        <span key={i} className="flex items-center gap-1">
          <ChevronRight size={14} />
          {crumb.href ? (
            <Link to={crumb.href} className="hover:text-primary-600 dark:hover:text-primary-400">
              {crumb.label}
            </Link>
          ) : (
            <span className="text-gray-800 dark:text-gray-200 font-medium">{crumb.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
