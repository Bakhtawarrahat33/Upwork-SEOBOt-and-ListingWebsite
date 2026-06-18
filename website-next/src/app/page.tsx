import Link from "next/link";
import { getJobs, getProducts, getServices, getBlogs, getCampaignStats, getRecentCampaigns, getRecentLogs, getSyncStatus } from "@/lib/db";
import ItemCard from "@/components/ItemCard";
import { ArrowRight, Briefcase, Package, Wrench, FileText, Activity, Circle } from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const statusDot: Record<string, string> = {
  Running: "bg-emerald-500",
  Stopped: "bg-gray-400",
  Idle: "bg-blue-500",
  Failed: "bg-red-500",
};

const logDot: Record<string, string> = {
  info: "text-blue-500",
  success: "text-emerald-500",
  warning: "text-amber-500",
  error: "text-red-500",
};

const sectionMeta: Record<string, { label: string; color: string; lightBg: string; border: string }> = {
  jobs: { label: "Job", color: "bg-blue-500", lightBg: "bg-blue-50/40", border: "border-blue-200/50" },
  products: { label: "Product", color: "bg-emerald-500", lightBg: "bg-emerald-50/40", border: "border-emerald-200/50" },
  services: { label: "Service", color: "bg-amber-500", lightBg: "bg-amber-50/40", border: "border-amber-200/50" },
  blogs: { label: "Blog", color: "bg-violet-500", lightBg: "bg-violet-50/40", border: "border-violet-200/50" },
};

export default async function Home() {
  const [jobs, products, services, blogs, stats, campaigns, logs, syncStatus] = await Promise.all([
    getJobs(),
    getProducts(),
    getServices(),
    getBlogs(),
    getCampaignStats(),
    getRecentCampaigns(5),
    getRecentLogs(8),
    getSyncStatus(),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const runningCount = stats.campaigns.find((c: any) => c.status === 'Running')?.count || 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const totalCampaigns = stats.campaigns.reduce((sum: number, c: any) => sum + parseInt(c.count), 0);
  const contentTodayTotal = parseInt(stats.contentToday.products) + parseInt(stats.contentToday.blogs) + parseInt(stats.contentToday.services);
  const totalItems = jobs.length + products.length + services.length + blogs.length;

  const statBoxes = [
    { value: runningCount, label: "Running Campaigns", icon: Activity },
    { value: stats.jobsToday, label: "Jobs Today", icon: Briefcase },
    { value: contentTodayTotal, label: "Content Today", icon: FileText },
  ];

  const sections = [
    { title: "Latest Jobs", href: "/jobs", items: jobs.slice(0, 3), type: "jobs" as const },
    { title: "Latest Products", href: "/products", items: products.slice(0, 3), type: "products" as const },
    { title: "Latest Services", href: "/services", items: services.slice(0, 3), type: "services" as const },
    { title: "Latest Blogs", href: "/blogs", items: blogs.slice(0, 3), type: "blogs" as const },
  ];

  return (
    <div className="space-y-10 animate-fadeIn">
      <section className="text-center py-10">
        <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3.5 py-1 text-xs font-medium text-blue-700 ring-1 ring-blue-700/10 mb-4">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Last synced: {syncStatus.lastSyncedAt ? new Date(syncStatus.lastSyncedAt).toLocaleString() : 'Not synced yet'}
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
          Automation
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-blue-400"> Dashboard</span>
        </h1>
        <p className="mt-2 text-sm text-gray-500 max-w-lg mx-auto leading-relaxed">
          Live overview of your campaigns, jobs, and generated content across all channels.
        </p>
        <div className="mt-5 flex items-center justify-center gap-3">
          <Link
            href="/jobs"
            className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-800 transition-all duration-200 shadow-sm hover:shadow-md"
          >
            Browse Jobs
            <Briefcase className="w-4 h-4" />
          </Link>
          <Link
            href="/post"
            className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 shadow-sm"
          >
            <Package className="w-4 h-4" />
            Post a Listing
          </Link>
        </div>
      </section>

      <div className="grid grid-cols-3 gap-4">
        {statBoxes.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className={`bg-white rounded-xl border border-gray-200 px-5 py-4 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 animate-slideUp stagger-${i + 1}`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-2xl font-bold text-gray-900 tracking-tight">{stat.value}</div>
                <Icon className="w-4 h-4 text-gray-300" />
              </div>
              <div className="text-xs text-gray-500 font-medium">{stat.label}</div>
            </div>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-[1fr_300px] gap-8">
        <div className="space-y-8">
          {sections.map((section, si) => {
            const meta = sectionMeta[section.type];
            return (
              <section key={section.title} className={`animate-slideUp stagger-${si + 1}`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`h-5 w-1 rounded-full ${meta.color}`} />
                    <h2 className="text-base font-semibold text-gray-900">{section.title}</h2>
                  </div>
                  <Link
                    href={section.href}
                    className="inline-flex items-center gap-0.5 text-xs font-medium text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    View all
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
                {section.items.length === 0 ? (
                  <div className="bg-white rounded-xl border border-dashed border-gray-200 py-8 text-center transition-colors hover:border-gray-300">
                    <p className="text-gray-400 text-sm">No {section.type} yet.</p>
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-3 items-stretch">
                    {// eslint-disable-next-line @typescript-eslint/no-explicit-any
                    section.items.map((item: any) => (
                      <div key={item.id} className="animate-slideUp">
                        <ItemCard
                          id={item.id}
                          title={item.title}
                          description={item.description || item.tagline || item.metaDescription || (item.content ? item.content : undefined)}
                          type={section.type}
                          meta={item.niche || item.platform || item.category}
                          date={item.createdAt ? new Date(item.createdAt).toLocaleDateString() : undefined}
                          topics={item.topics || undefined}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>

        <div className="space-y-4">
          <section className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[11px] font-semibold text-gray-900 uppercase tracking-widest">Campaigns</h2>
              <span className="inline-flex items-center justify-center min-w-[1.25rem] h-4 rounded-full bg-gray-100 text-[10px] font-semibold text-gray-600 px-1.5">
                {totalCampaigns}
              </span>
            </div>
            {campaigns.length === 0 ? (
              <p className="text-gray-400 text-xs">No campaigns yet.</p>
            ) : (
              <div className="space-y-0.5">
                {// eslint-disable-next-line @typescript-eslint/no-explicit-any
                campaigns.map((c: any) => (
                  <div key={c.id} className="flex items-center justify-between py-2 px-2.5 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div className="min-w-0 flex items-center gap-2">
                      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${statusDot[c.status] || 'bg-gray-400'}`} />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-gray-900 truncate">{c.name}</p>
                        <p className="text-[11px] text-gray-400 truncate mt-0.5">{c.search || 'No search term'}</p>
                      </div>
                    </div>
                    <span className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset shrink-0 ml-2 bg-gray-100 text-gray-600 ring-gray-500/20">
                      {c.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="bg-white rounded-xl border border-gray-200 p-4">
            <h2 className="text-[11px] font-semibold text-gray-900 uppercase tracking-widest mb-3">Recent Activity</h2>
            {logs.length === 0 ? (
              <p className="text-gray-400 text-xs">No recent activity.</p>
            ) : (
              <div className="space-y-1 max-h-60 overflow-y-auto pr-1 -mr-1">
                {// eslint-disable-next-line @typescript-eslint/no-explicit-any
                logs.map((log: any, idx: number) => (
                  <div key={idx} className="flex gap-2 py-1.5 border-b border-gray-50 last:border-0">
                    <Circle className={`w-1.5 h-1.5 mt-1 shrink-0 fill-current ${logDot[log.level] || 'text-gray-400'}`} />
                    <div className="min-w-0">
                      <span className="text-[10px] font-semibold text-gray-400 uppercase">{log.level}</span>
                      <p className="text-gray-500 line-clamp-2 leading-snug text-[11px] mt-0.5">{log.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="bg-white rounded-xl border border-gray-200 p-4">
            <h2 className="text-[11px] font-semibold text-gray-900 uppercase tracking-widest mb-3">Content</h2>
            <div className="space-y-3">
              {[
                { label: "Jobs", count: jobs.length, color: "bg-blue-500", icon: Briefcase },
                { label: "Products", count: products.length, color: "bg-emerald-500", icon: Package },
                { label: "Services", count: services.length, color: "bg-amber-500", icon: Wrench },
                { label: "Blogs", count: blogs.length, color: "bg-violet-500", icon: FileText },
              ].map(({ label, count, color, icon: Icon }) => {
                const pct = totalItems ? Math.round((count / totalItems) * 100) : 0;
                return (
                  <div key={label}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="flex items-center gap-1.5 text-xs text-gray-600">
                        <Icon className="w-3 h-3" />
                        {label}
                      </span>
                      <span className="text-xs font-semibold text-gray-900">{count}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`${color} h-1.5 rounded-full transition-all duration-500`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
