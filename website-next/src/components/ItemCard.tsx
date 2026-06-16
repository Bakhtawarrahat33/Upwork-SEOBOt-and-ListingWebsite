"use client";

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
  jobs: { label: "Job", color: "bg-blue-50 text-blue-700 ring-blue-700/10", accent: "border-blue-200 hover:border-blue-400" },
  products: { label: "Product", color: "bg-emerald-50 text-emerald-700 ring-emerald-700/10", accent: "border-emerald-200 hover:border-emerald-400" },
  services: { label: "Service", color: "bg-amber-50 text-amber-700 ring-amber-700/10", accent: "border-amber-200 hover:border-amber-400" },
  blogs: { label: "Blog", color: "bg-violet-50 text-violet-700 ring-violet-700/10", accent: "border-violet-200 hover:border-violet-400" },
};

export default function ItemCard({ id, title, description, type, meta, date }: ItemCardProps) {
  const config = typeConfig[type];

  return (
    <Link
      href={`/${type}/${id}`}
      className={`group block bg-white rounded-xl border p-5 transition-all duration-200 hover:shadow-lg ${config.accent}`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${config.color}`}>
          {config.label}
        </span>
        {date && (
          <span className="text-xs text-gray-400">{date}</span>
        )}
      </div>

      <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-blue-700 transition-colors line-clamp-2">
        {title}
      </h3>

      {description && (
        <p className="text-gray-600 text-sm line-clamp-2 mb-3 leading-relaxed">
          {description}
        </p>
      )}

      <div className="flex items-center justify-between mt-auto">
        {meta ? (
          <span className="inline-block text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded">
            {meta}
          </span>
        ) : (
          <span />
        )}
        <span className="text-blue-600 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
          View details &rarr;
        </span>
      </div>
    </Link>
  );
}
