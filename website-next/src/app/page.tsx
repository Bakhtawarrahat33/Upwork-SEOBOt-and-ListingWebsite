import Link from "next/link";
import { getJobs, getProducts, getServices, getBlogs, getCampaignStats, getRecentCampaigns, getRecentLogs } from "@/lib/db";
import ItemCard from "@/components/ItemCard";

export const revalidate = 30;

function StatCard({ value, label, icon, delay }: { value: string | number; label: string; icon: React.ReactNode; delay: string }) {
  return (
    <div className={`bg-white/10 backdrop-blur-sm rounded-xl px-5 py-4 border border-white/10 animate-fade-in-up ${delay}`}>
      <div className="flex items-center gap-3 mb-1">
        <div className="text-blue-200/80">{icon}</div>
        <div className="text-2xl font-bold tracking-tight">{value}</div>
      </div>
      <div className="text-xs text-blue-200 uppercase tracking-wide ml-9">{label}</div>
    </div>
  );
}

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
  const totalItems = jobs.length + products.length + services.length + blogs.length;

  const sections = [
    { title: "Latest Jobs", href: "/jobs", items: jobs.slice(0, 3), type: "jobs" as const },
    { title: "Latest Products", href: "/products", items: products.slice(0, 3), type: "products" as const },
    { title: "Latest Services", href: "/services", items: services.slice(0, 3), type: "services" as const },
    { title: "Latest Blogs", href: "/blogs", items: blogs.slice(0, 3), type: "blogs" as const },
  ];

  return (
    <div className="space-y-10">
      {/* Hero + Stats */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-700 via-blue-700 to-indigo-800 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.12),transparent_60%)]" />
        <div className="absolute top-0 right-0 w-72 h-72 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="relative z-10 px-8 py-12">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 mb-4">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/30 px-3 py-1 text-xs font-medium border border-blue-400/20 animate-fade-in-up">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse-glow" />
                Live Dashboard
              </span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold mb-3 leading-tight animate-fade-in-up delay-100">
              Automation Dashboard
            </h1>
            <p className="text-blue-100 mb-6 leading-relaxed max-w-xl animate-fade-in-up delay-200">
              Live overview of your campaigns, jobs, and generated content. Everything your automation pipeline produces, in one place.
            </p>
            <div className="flex flex-wrap gap-3 animate-fade-in-up delay-300">
              <Link
                href="/jobs"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white text-blue-700 font-semibold text-sm hover:bg-blue-50 transition-all shadow-lg shadow-blue-900/20"
              >
                Browse Jobs
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
              <Link
                href="/post"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600/30 text-white font-semibold text-sm hover:bg-blue-600/40 transition-all border border-blue-400/30"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Post a Listing
              </Link>
            </div>
          </div>

          {/* Live Stats */}
          <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
              value={runningCount}
              label="Running Campaigns"
              delay="delay-100"
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                </svg>
              }
            />
            <StatCard
              value={stats.jobsToday}
              label="Jobs Today"
              delay="delay-200"
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z" />
                </svg>
              }
            />
            <StatCard
              value={contentTodayTotal}
              label="Content Today"
              delay="delay-300"
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
              }
            />
            <StatCard
              value={totalItems}
              label="Total Items"
              delay="delay-400"
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
                </svg>
              }
            />
          </div>
        </div>
      </section>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-8">
        {/* Main - 2/3 */}
        <div className="lg:col-span-2 space-y-10">
          {sections.map((section, i) => (
            <section key={section.title}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900">{section.title}</h2>
                <Link
                  href={section.href}
                  className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
                >
                  View all
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
              {section.items.length === 0 ? (
                <div className="bg-white rounded-xl border border-dashed border-gray-200 p-10 text-center">
                  <div className="text-gray-300 mb-2">
                    <svg className="w-10 h-10 mx-auto" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                    </svg>
                  </div>
                  <p className="text-gray-400 text-sm">No {section.type} yet.</p>
                  <p className="text-gray-400 text-xs mt-1">Start a campaign to populate.</p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
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
        <div className="space-y-6">
          {/* Campaigns */}
          <section className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide flex items-center gap-2">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                </svg>
                Campaigns
              </h2>
              <span className="inline-flex items-center justify-center min-w-[1.5rem] h-5 rounded-full bg-gray-100 text-xs font-semibold text-gray-600 px-1.5">
                {totalCampaigns}
              </span>
            </div>
            {campaigns.length === 0 ? (
              <p className="text-gray-400 text-sm">No campaigns yet.</p>
            ) : (
              <div className="space-y-2">
                {campaigns.map((c: any) => (
                  <div key={c.id} className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-gray-50/50 hover:bg-gray-50 transition-colors">
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

          {/* Recent Activity */}
          <section className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide flex items-center gap-2 mb-4">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Recent Activity
            </h2>
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

          {/* Content Breakdown */}
          <section className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide flex items-center gap-2 mb-4">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 107.5 7.5h-7.5V6z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0013.5 3v7.5z" />
              </svg>
              Content Breakdown
            </h2>
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
                        className={`${color} h-2 rounded-full transition-all duration-500`}
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
