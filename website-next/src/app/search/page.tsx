"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense, useState, useEffect } from "react";
import { Briefcase, Package, Wrench, FileText, Search, ArrowRight } from "lucide-react";

const typeConfig: Record<string, { label: string; icon: React.ElementType; badge: string; ring: string; href: string }> = {
  products: { label: "Product", icon: Package, badge: "text-emerald-600 bg-emerald-50", ring: "ring-emerald-700/10", href: "/products" },
  blogs: { label: "Blog", icon: FileText, badge: "text-violet-600 bg-violet-50", ring: "ring-violet-700/10", href: "/blogs" },
  services: { label: "Service", icon: Wrench, badge: "text-amber-600 bg-amber-50", ring: "ring-amber-700/10", href: "/services" },
  jobs: { label: "Job", icon: Briefcase, badge: "text-blue-600 bg-blue-50", ring: "ring-blue-700/10", href: "/jobs" },
};

function SearchResults() {
  const searchParams = useSearchParams();
  const q = searchParams.get("q") || "";

  const [results, setResults] = useState<{ id: string; title: string; description?: string; type: string; meta?: string; createdAt: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    setError(false);
    fetch(`/api/search?q=${encodeURIComponent(q.trim())}`)
      .then((res) => {
        if (!res.ok) throw new Error("Search failed");
        return res.json();
      })
      .then((data) => {
        setResults(data);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [q]);

  if (!q.trim()) {
    return (
      <div className="text-center py-20">
        <Search className="w-12 h-12 mx-auto text-gray-300 mb-4" />
        <p className="text-gray-500 text-sm">Enter a keyword to search across jobs, products, services, and blogs.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4 py-8">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse bg-white rounded-lg border border-gray-200 p-5">
            <div className="h-4 bg-gray-200 rounded w-1/4 mb-3" />
            <div className="h-5 bg-gray-200 rounded w-3/4 mb-2" />
            <div className="h-4 bg-gray-200 rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return <p className="text-red-500 text-sm py-8 text-center">Something went wrong. Try again.</p>;
  }

  if (results.length === 0) {
    return (
      <div className="text-center py-20">
        <Search className="w-12 h-12 mx-auto text-gray-300 mb-4" />
        <p className="text-gray-500 text-sm">No results found for &ldquo;{q}&rdquo;.</p>
        <p className="text-gray-400 text-xs mt-1">Try a different keyword.</p>
      </div>
    );
  }

  const grouped: Record<string, typeof results> = {};
  for (const r of results) {
    if (!grouped[r.type]) grouped[r.type] = [];
    grouped[r.type].push(r);
  }

  return (
    <div className="space-y-10">
      {Object.entries(grouped).map(([type, items]) => {
        const config = typeConfig[type];
        if (!config) return null;
        const Icon = config.icon;
        return (
          <section key={type}>
            <div className="flex items-center gap-2 mb-4">
              <Icon className="w-4 h-4 text-gray-500" />
              <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500">{config.label}s</h2>
            </div>
            <div className="space-y-3">
              {items.map((item) => (
                <Link
                  key={item.id}
                  href={`/${type}/${item.id}`}
                  className="block bg-white rounded-lg border border-gray-200 p-5 transition-all hover:shadow-md hover:-translate-y-0.5"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ${config.badge} ${config.ring}`}>
                      <Icon className="w-3 h-3" />
                      {config.label}
                    </span>
                    {item.meta && (
                      <span className="text-[11px] text-gray-400">{item.meta}</span>
                    )}
                  </div>
                  <h3 className="text-base font-semibold text-gray-900">{item.title}</h3>
                  {item.description && (
                    <p className="mt-1 text-sm text-gray-600 line-clamp-2">{item.description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-gray-400">{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ""}</span>
                    <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-blue-600">
                      View details <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export default function SearchPage() {
  return (
    <div className="max-w-3xl mx-auto py-8 px-4 animate-fadeIn">
      <h1 className="text-2xl font-semibold tracking-tight text-gray-950 mb-6">Search</h1>
      <Suspense fallback={
        <div className="space-y-4 py-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse bg-white rounded-lg border border-gray-200 p-5">
              <div className="h-4 bg-gray-200 rounded w-1/4 mb-3" />
              <div className="h-5 bg-gray-200 rounded w-3/4 mb-2" />
              <div className="h-4 bg-gray-200 rounded w-1/2" />
            </div>
          ))}
        </div>
      }>
        <SearchResults />
      </Suspense>
    </div>
  );
}
