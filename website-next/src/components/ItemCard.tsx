import Link from "next/link";
import { ArrowRight, Briefcase, Package, Wrench, FileText } from "lucide-react";

interface ItemCardProps {
  id: string;
  title: string;
  description?: string;
  type: "jobs" | "products" | "services" | "blogs";
  meta?: string;
  date?: string;
  topics?: string[];
}

function parseTopics(topics: unknown): string[] {
  if (!topics) return [];
  if (Array.isArray(topics)) return topics;
  if (typeof topics === "string") {
    try {
      const parsed = JSON.parse(topics);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function stripMarkdown(text: string): string {
  return text
    .replace(/#{1,6}\s+/g, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`{1,3}.+?`{1,3}/g, "")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")
    .replace(/>\s+/g, "")
    .replace(/[-*+]\s+/g, "")
    .replace(/\n{2,}/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanDescription(text: string | undefined | null, maxLength = 150): string | undefined {
  if (!text) return undefined;
  const cleaned = stripMarkdown(text);
  if (!cleaned) return undefined;
  return cleaned.length > maxLength ? cleaned.substring(0, maxLength) + "..." : cleaned;
}

const typeConfig = {
  jobs: {
    label: "Job",
    icon: Briefcase,
    badge: "text-blue-600 bg-blue-50",
    borderHover: "group-hover:border-blue-200",
    accent: "bg-blue-500",
    badgeRing: "ring-blue-700/10",
  },
  products: {
    label: "Product",
    icon: Package,
    badge: "text-emerald-600 bg-emerald-50",
    borderHover: "group-hover:border-emerald-200",
    accent: "bg-emerald-500",
    badgeRing: "ring-emerald-700/10",
  },
  services: {
    label: "Service",
    icon: Wrench,
    badge: "text-amber-600 bg-amber-50",
    borderHover: "group-hover:border-amber-200",
    accent: "bg-amber-500",
    badgeRing: "ring-amber-700/10",
  },
  blogs: {
    label: "Blog",
    icon: FileText,
    badge: "text-violet-600 bg-violet-50",
    borderHover: "group-hover:border-violet-200",
    accent: "bg-violet-500",
    badgeRing: "ring-violet-700/10",
  },
};

export default function ItemCard({ id, title, description, type, meta, date, topics }: ItemCardProps) {
  const config = typeConfig[type];
  const displayTopics = parseTopics(topics);
  const displayDescription = cleanDescription(description);

  return (
    <Link
      href={`/${type}/${id}`}
      className={`group relative flex flex-col justify-between h-full p-6 bg-white border border-slate-100 rounded-xl shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${config.borderHover}`}
    >
      <div className="absolute top-0 left-0 right-0 h-1 rounded-t-xl overflow-hidden">
        <div className={`h-full rounded-t-xl w-0 group-hover:w-full transition-all duration-300 ${config.accent}`} />
      </div>

      <div>
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className={`inline-flex items-center gap-1 font-medium ${config.badge} px-2 py-0.5 rounded ring-1 ${config.badgeRing}`}>
            <config.icon className="w-3 h-3" />
            {config.label}
          </span>
          {date && <span>{date}</span>}
        </div>

        <h3 className="mt-4 text-base font-bold text-slate-900 line-clamp-2 group-hover:text-blue-600 transition-colors duration-200">
          {title}
        </h3>

        {displayDescription ? (
          <p className="mt-2 text-sm text-slate-500 line-clamp-3 leading-relaxed">
            {displayDescription}
          </p>
        ) : (
          <div className="mt-2 space-y-1.5">
            <div className="h-2.5 rounded bg-slate-100 w-full" />
            <div className="h-2.5 rounded bg-slate-100 w-3/4" />
            <div className="h-2.5 rounded bg-slate-100 w-1/2" />
          </div>
        )}
      </div>

      <div className="mt-6 pt-4 border-t border-slate-100">
        {(displayTopics.length > 0 || meta) && (
          <div className="flex items-center justify-between">
            {displayTopics.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {displayTopics.slice(0, 3).map((topic) => (
                  <span
                    key={topic}
                    className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500"
                  >
                    {topic}
                  </span>
                ))}
              </div>
            ) : (
              <span />
            )}
            {meta && (
              <span className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-500 ring-1 ring-slate-200">
                {meta}
              </span>
            )}
          </div>
        )}
        {!displayTopics.length && !meta && (
          <div className="flex items-center justify-end">
            <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200">
              Read more
              <ArrowRight className="w-3 h-3" />
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}
