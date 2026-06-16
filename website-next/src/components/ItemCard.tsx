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
  jobs: { label: "Job", color: "bg-blue-50 text-blue-700 ring-blue-700/10", dot: "bg-blue-500" },
  products: { label: "Product", color: "bg-emerald-50 text-emerald-700 ring-emerald-700/10", dot: "bg-emerald-500" },
  services: { label: "Service", color: "bg-amber-50 text-amber-700 ring-amber-700/10", dot: "bg-amber-500" },
  blogs: { label: "Blog", color: "bg-violet-50 text-violet-700 ring-violet-700/10", dot: "bg-violet-500" },
};

export default function ItemCard({ id, title, description, type, meta, date }: ItemCardProps) {
  const config = typeConfig[type];

  return (
    <Link
      href={`/${type}/${id}`}
      className="group relative block bg-white rounded-xl border border-gray-200 p-5 transition-all duration-200 hover:shadow-lg hover:border-gray-300 hover:-translate-y-0.5"
    >
      {/* Top row */}
      <div className="flex items-center justify-between mb-3">
        <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${config.color}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
          {config.label}
        </span>
        {date && (
          <span className="text-xs text-gray-400">{date}</span>
        )}
      </div>

      {/* Title */}
      <h3 className="text-base font-semibold text-gray-900 mb-2 group-hover:text-blue-700 transition-colors line-clamp-2 leading-snug">
        {title}
      </h3>

      {/* Description */}
      {description && (
        <p className="text-gray-500 text-sm line-clamp-2 mb-4 leading-relaxed">
          {description}
        </p>
      )}

      {/* Bottom row */}
      <div className="flex items-center justify-between">
        {meta ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 bg-gray-50 px-2.5 py-1 rounded-md ring-1 ring-gray-200">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            {meta}
          </span>
        ) : (
          <span />
        )}
        <span className="flex items-center gap-1 text-blue-600 text-sm font-medium opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
          View details
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </span>
      </div>
    </Link>
  );
}
