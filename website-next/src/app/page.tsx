import Link from "next/link";
import { getJobs, getProducts, getServices, getBlogs, getCampaignStats, getRecentCampaigns, getRecentLogs, getSyncStatus } from "@/lib/db";
import ItemCard from "@/components/ItemCard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const statusColor: Record<string, string> = {
  Running: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  Stopped: "bg-gray-50 text-gray-600 ring-gray-500/20",
  Idle: "bg-blue-50 text-blue-700 ring-blue-600/20",
  Failed: "bg-red-50 text-red-700 ring-red-600/20",
};

const logColor: Record<string, string> = {
  info: "text-blue-600",
  success: "text-emerald-600",
  warning: "text-amber-600",
  error: "text-red-600",
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

  const runningCount = stats.campaigns.find((c: any) => c.status === 'Running')?.count || 0;
  const totalCampaigns = stats.campaigns.reduce((sum: number, c: any) => sum + parseInt(c.count), 0);
  const contentTodayTotal = parseInt(stats.contentToday.products) + parseInt(stats.contentToday.blogs) + parseInt(stats.contentToday.services);
  const totalItems = jobs.length + products.length + services.length + blogs.length;

  const sections = [
    { title: "Latest Jobs", href: "/jobs", items: jobs.slice(0, 3), type: "jobs" as const },
    { title: "Latest Products", href: "/products", items: products.slice(0, 3), type: "products" as const },
    { title: "Latest Services", href: "/services", items: services.slice(0, 3), type: "services" as const },
    { title: "Latest Blogs", href: "/blogs", items: blogs.slice(0, 3), type: "blogs" as const },
  ];

  return (
    <div className="space-y-16">
      <section className="text-center py-12">
        <h1 className="text-4xl font-bold text-gray-900 tracking-tight">
          Automation Dashboard
        </h1>
        <p className="mt-3 text-lg text-gray-500 max-w-xl mx-auto">
          Live overview of your campaigns, jobs, and generated content.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link
            href="/jobs"
            className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
          >
            Browse Jobs
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
          <Link
            href="/post"
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Post a Listing
          </Link>
        </div>
        <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-1.5 text-xs text-gray-500">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Last synced: {syncStatus.lastSyncedAt ? new Date(syncStatus.lastSyncedAt).toLocaleString() : 'Not synced yet'}
        </div>
      </section>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { value: runningCount, label: "Running Campaigns" },
          { value: stats.jobsToday, label: "Jobs Today" },
          { value: contentTodayTotal, label: "Content Today" },
          { value: totalItems, label: "Total Items" },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border border-gray-200 px-5 py-4">
            <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-12">
          {sections.map((section) => (
            <section key={section.title}>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xl font-semibold text-gray-900">{section.title}</h2>
                <Link
                  href={section.href}
                  className="inline-flex items-center gap-0.5 text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
                >
                  View all
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
              {section.items.length === 0 ? (
                <div className="bg-white rounded-xl border border-dashed border-gray-200 p-12 text-center">
                  <p className="text-gray-400 text-sm">No {section.type} yet.</p>
                </div>
              ) : (
                <div className="grid gap-5 sm:grid-cols-2">
                  {section.items.map((item: any) => (
                    <ItemCard
                      key={item.id}
                      id={item.id}
                      title={item.title}
                      description={item.description || item.tagline || item.metaDescription}
                      type={section.type}
                      meta={item.niche || item.platform || item.category}
                      date={item.createdAt ? new Date(item.createdAt).toLocaleDateString() : undefined}
                    />
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>

        <div className="space-y-6">
          <section className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-900">Campaigns</h2>
              <span className="inline-flex items-center justify-center min-w-[1.5rem] h-5 rounded-full bg-gray-100 text-xs font-semibold text-gray-600 px-1.5">
                {totalCampaigns}
              </span>
            </div>
            {campaigns.length === 0 ? (
              <p className="text-gray-400 text-sm">No campaigns yet.</p>
            ) : (
              <div className="space-y-1">
                {campaigns.map((c: any) => (
                  <div key={c.id} className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
                      <p className="text-xs text-gray-400 truncate mt-0.5">{c.search || 'No search term'}</p>
                    </div>
                    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset shrink-0 ml-3 ${statusColor[c.status] || statusColor.Idle}`}>
                      {c.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Recent Activity</h2>
            {logs.length === 0 ? (
              <p className="text-gray-400 text-sm">No recent activity.</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1 -mr-1">
                {logs.map((log: any, idx: number) => (
                  <div key={idx} className="flex gap-3 text-sm py-1.5 border-b border-gray-50 last:border-0">
                    <span className={`text-xs font-semibold shrink-0 w-14 ${logColor[log.level] || 'text-gray-500'}`}>
                      {log.level}
                    </span>
                    <p className="text-gray-600 line-clamp-2 leading-snug text-xs">{log.message}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Content Breakdown</h2>
            <div className="space-y-3">
              {[
                { label: "Jobs", count: jobs.length, color: "bg-blue-500" },
                { label: "Products", count: products.length, color: "bg-emerald-500" },
                { label: "Services", count: services.length, color: "bg-amber-500" },
                { label: "Blogs", count: blogs.length, color: "bg-violet-500" },
              ].map(({ label, count, color }) => {
                const pct = totalItems ? Math.round((count / totalItems) * 100) : 0;
                return (
                  <div key={label}>
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-sm text-gray-600">{label}</span>
                      <span className="text-sm font-semibold text-gray-900">{count}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div
                        className={`${color} h-2 rounded-full transition-all`}
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
