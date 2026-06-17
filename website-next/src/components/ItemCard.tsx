import Link from "next/link";

interface ItemCardProps {
  id: string;
  title: string;
  description?: string;
  type: "jobs" | "products" | "services" | "blogs";
  meta?: string;
  date?: string;
}

const typeConfig = {
  jobs: { label: "Job", color: "bg-blue-50 text-blue-700 ring-blue-700/10" },
  products: { label: "Product", color: "bg-emerald-50 text-emerald-700 ring-emerald-700/10" },
  services: { label: "Service", color: "bg-amber-50 text-amber-700 ring-amber-700/10" },
  blogs: { label: "Blog", color: "bg-violet-50 text-violet-700 ring-violet-700/10" },
};

export default function ItemCard({ id, title, description, type, meta, date }: ItemCardProps) {
  const config = typeConfig[type];

  return (
    <Link
      href={`/${type}/${id}`}
      className="group relative flex flex-col bg-white rounded-xl border border-gray-200 p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md"
    >
      <div className="flex items-center justify-between mb-3">
        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${config.color}`}>
          {config.label}
        </span>
        {date && <span className="text-xs text-gray-400">{date}</span>}
      </div>

      <h3 className="text-base font-semibold text-gray-900 leading-snug line-clamp-2 mb-2 group-hover:text-blue-600 transition-colors">
        {title}
      </h3>

      {description && (
        <p className="text-sm text-gray-500 leading-relaxed line-clamp-3 mb-4">
          {description}
        </p>
      )}

      <div className="mt-auto flex items-center justify-between">
        {meta ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-500 ring-1 ring-gray-200">
            {meta}
          </span>
        ) : (
          <span />
        )}
        <span className="inline-flex items-center gap-0.5 text-sm font-medium text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
          Read more
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </span>
      </div>
    </Link>
  );
}
