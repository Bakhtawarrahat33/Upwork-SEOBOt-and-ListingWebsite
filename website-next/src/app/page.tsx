import Link from "next/link";
import { getJobs, getProducts, getServices, getBlogs, getCampaignStats, getRecentCampaigns, getRecentLogs } from "@/lib/db";
import ItemCard from "@/components/ItemCard";

export const revalidate = 30; // Revalidate every 30 seconds

export default async function Home() {
  const [jobs, products, services, blogs, stats, campaigns, logs] = await Promise.all([
    getJobs(),
    getProducts(),
    getServices(),
    getBlogs(),
    getCampaignStats(),
    getRecentCampaigns(5),
    getRecentLogs(8),
  ]);

  const runningCount = stats.campaigns.find((c: any) => c.status === 'Running')?.count || 0;
  const totalCampaigns = stats.campaigns.reduce((sum: number, c: any) => sum + parseInt(c.count), 0);
  const contentTodayTotal = parseInt(stats.contentToday.products) + parseInt(stats.contentToday.blogs) + parseInt(stats.contentToday.services);

  const sections = [
    { title: "Latest Jobs", href: "/jobs", items: jobs.slice(0, 3), type: "jobs" as const },
    { title: "Latest Products", href: "/products", items: products.slice(0, 3), type: "products" as const },
    { title: "Latest Services", href: "/services", items: services.slice(0, 3), type: "services" as const },
    { title: "Latest Blogs", href: "/blogs", items: blogs.slice(0, 3), type: "blogs" as const },
  ];

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

  return (
    <div className="space-y-12">
      {/* Hero + Stats */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-700 to-indigo-800 text-white">
        <div className="relative z-10 px-8 py-12">
          <div className="max-w-2xl">
            <h1 className="text-3xl md:text-4xl font-bold mb-3 leading-tight">
              Automation Dashboard
            </h1>
            <p className="text-blue-100 mb-6 leading-relaxed">
              Live overview of your campaigns, jobs, and generated content.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/jobs"
                className="inline-flex items-center px-5 py-2.5 rounded-lg bg-white text-blue-700 font-semibold text-sm hover:bg-blue-50 transition-colors"
              >
                Browse Jobs
              </Link>
              <Link
                href="/post"
                className="inline-flex items-center px-5 py-2.5 rounded-lg bg-blue-600/30 text-white font-semibold text-sm hover:bg-blue-600/40 transition-colors border border-blue-400/30"
              >
                Post a Listing
              </Link>
            </div>
          </div>

          {/* Live Stats */}
          <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-5 py-4 border border-white/10">
              <div className="text-2xl font-bold">{runningCount}</div>
              <div className="text-xs text-blue-200 uppercase tracking-wide">Running Campaigns</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-5 py-4 border border-white/10">
              <div className="text-2xl font-bold">{stats.jobsToday}</div>
              <div className="text-xs text-blue-200 uppercase tracking-wide">Jobs Today</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-5 py-4 border border-white/10">
              <div className="text-2xl font-bold">{contentTodayTotal}</div>
              <div className="text-xs text-blue-200 uppercase tracking-wide">Content Today</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-5 py-4 border border-white/10">
              <div className="text-2xl font-bold">{jobs.length + products.length + services.length + blogs.length}</div>
              <div className="text-xs text-blue-200 uppercase tracking-wide">Total Items</div>
            </div>
          </div>
        </div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      </section>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Main Content - 2/3 */}
        <div className="lg:col-span-2 space-y-10">
          {sections.map((section) => (
            <section key={section.title}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900">{section.title}</h2>
                <Link
                  href={section.href}
                  className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
                >
                  View all &rarr;
                </Link>
              </div>
              {section.items.length === 0 ? (
                <div className="bg-white rounded-xl border border-dashed border-gray-200 p-8 text-center">
                  <p className="text-gray-400 text-sm">No {section.type} yet. Start a campaign to populate.</p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
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

        {/* Sidebar - 1/3 */}
        <div className="space-y-8">
          {/* Campaigns */}
          <section className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Campaigns</h2>
              <span className="text-xs text-gray-500">{totalCampaigns} total</span>
            </div>
            {campaigns.length === 0 ? (
              <p className="text-gray-400 text-sm">No campaigns yet.</p>
            ) : (
              <div className="space-y-3">
                {campaigns.map((c: any) => {
                  const progress = c.progress || {};
                  return (
                    <div key={c.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
                        <p className="text-xs text-gray-400 truncate">{c.search || 'No search term'}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${statusColor[c.status] || statusColor.Idle}`}>
                          {c.status}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Recent Activity */}
          <section className="bg-white rounded-xl border border-gray-100 p-5">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-4">Recent Activity</h2>
            {logs.length === 0 ? (
              <p className="text-gray-400 text-sm">No recent activity.</p>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                {logs.map((log: any, idx: number) => (
                  <div key={idx} className="flex gap-3 text-sm">
                    <span className={`text-xs font-semibold shrink-0 w-14 ${logColor[log.level] || 'text-gray-500'}`}>
                      {log.level}
                    </span>
                    <p className="text-gray-600 line-clamp-2 leading-snug">{log.message}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Quick Stats */}
          <section className="bg-white rounded-xl border border-gray-100 p-5">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-4">Content Breakdown</h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Jobs</span>
                <span className="text-sm font-semibold text-gray-900">{jobs.length}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1.5">
                <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${Math.min((jobs.length / Math.max(jobs.length + products.length + services.length + blogs.length, 1)) * 100, 100)}%` }} />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Products</span>
                <span className="text-sm font-semibold text-gray-900">{products.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Services</span>
                <span className="text-sm font-semibold text-gray-900">{services.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Blogs</span>
                <span className="text-sm font-semibold text-gray-900">{blogs.length}</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
