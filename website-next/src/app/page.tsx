import Link from "next/link";
import { getJobs, getProducts, getServices, getBlogs, getCampaignStats, getRecentCampaigns, getRecentLogs, getSyncStatus } from "@/lib/db";
import ItemCard from "@/components/ItemCard";
import DashboardAutoRefresh from "@/components/DashboardAutoRefresh";
import { ArrowRight, Briefcase, Activity, Circle, CalendarClock, Plus, Radio, TimerReset } from "lucide-react";

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

  const today = new Date();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jobsPostedToday = jobs.filter((j: any) => {
    if (!j.createdAt) return false;
    const d = new Date(j.createdAt);
    return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
  }).length;

  const lastCronRunText = syncStatus.lastSyncedAt
    ? new Date(syncStatus.lastSyncedAt).toLocaleString()
    : "No successful cron run recorded yet";

  const statBoxes = [
    { value: runningCount, label: "Campaigns running", icon: Activity, help: "Active Upwork campaigns", accent: "bg-emerald-500", iconBg: "bg-emerald-50", iconText: "text-emerald-600" },
    { value: jobsPostedToday, label: "Jobs saved today", icon: CalendarClock, help: "Jobs added to this site today", accent: "bg-indigo-500", iconBg: "bg-indigo-50", iconText: "text-indigo-600" },
    { value: jobs.length, label: "Total jobs", icon: Briefcase, help: "All jobs saved on this site", accent: "bg-blue-500", iconBg: "bg-blue-50", iconText: "text-blue-600" },
    { value: "15 min", label: "Cron schedule", icon: TimerReset, help: `Runs at :00, :15, :30, :45. Last cron run: ${lastCronRunText}`, accent: "bg-violet-500", iconBg: "bg-violet-50", iconText: "text-violet-600" },
  ];

  const sections = [
    { title: "Latest Jobs", href: "/jobs", items: jobs.slice(0, 3), type: "jobs" as const },
    { title: "Latest Products", href: "/products", items: products.slice(0, 3), type: "products" as const },
    { title: "Latest Services", href: "/services", items: services.slice(0, 3), type: "services" as const },
    { title: "Latest Blogs", href: "/blogs", items: blogs.slice(0, 3), type: "blogs" as const },
  ];

  return (
    <div className="space-y-10 animate-fadeIn">
      <section className="border-b border-gray-200 pb-8 pt-3">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
              <Radio className="h-3.5 w-3.5" />
              Last cron run {syncStatus.lastSyncedAt ? new Date(syncStatus.lastSyncedAt).toLocaleString() : 'not yet'}
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-gray-950 sm:text-4xl">
              Job & Content Monitor
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-gray-600">
              See the latest Upwork jobs your bot found, plus the product, service, and blog pages created from them.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/jobs"
              className="inline-flex items-center gap-2 rounded-md bg-gray-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-gray-800"
            >
              <Briefcase className="w-4 h-4" />
              View Jobs
            </Link>
            <Link
              href="/post"
              className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:border-gray-400 hover:bg-gray-50"
            >
              <Plus className="w-4 h-4" />
              Add Listing
            </Link>
          </div>
        </div>
        <div className="mt-4">
          <DashboardAutoRefresh />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statBoxes.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className={`relative overflow-hidden rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md animate-slideUp stagger-${i + 1}`}
            >
              <div className={`absolute inset-x-0 top-0 h-1 ${stat.accent}`} />
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-3xl font-semibold tracking-tight text-gray-950">{stat.value}</div>
                    <div className="mt-1 text-sm font-semibold text-gray-800">{stat.label}</div>
                  </div>
                <div className={`rounded-md p-2 ${stat.iconBg} ${stat.iconText}`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <p className="mt-3 text-xs leading-5 text-gray-500">{stat.help}</p>
            </div>
          );
        })}

      </div>

      <div className="grid lg:grid-cols-[1fr_300px] gap-8">
        <div className="space-y-12">
          {sections.map((section, si) => {
            const meta = sectionMeta[section.type];
            return (
              <section key={section.title} className={`animate-slideUp stagger-${si + 1}`}>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className={`h-6 w-1 rounded-full ${meta.color}`} />
                    <h2 className="text-lg font-semibold tracking-tight text-slate-900">{section.title}</h2>
                  </div>
                  <Link
                    href={section.href}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-slate-500 transition-colors hover:bg-gray-100 hover:text-blue-700"
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
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
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

        <div className="space-y-5 lg:sticky lg:top-20 lg:self-start">
          <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold uppercase tracking-wide text-gray-500">Search campaigns</h2>
            </div>
            {campaigns.length === 0 ? (
              <p className="text-gray-400 text-xs">No campaigns yet.</p>
            ) : (
              <div className="space-y-0.5">
                {// eslint-disable-next-line @typescript-eslint/no-explicit-any
                campaigns.map((c: any) => (
                  <div key={c.id} className="flex items-center justify-between rounded-md px-2.5 py-2 transition-colors hover:bg-gray-50">
                    <div className="min-w-0 flex items-center gap-2">
                      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${statusDot[c.status] || 'bg-gray-400'}`} />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-gray-900 truncate">{c.name}</p>
                        <p className="text-[11px] text-gray-400 truncate mt-0.5">{c.search || 'No search term'}</p>
                      </div>
                    </div>
                    <span className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset shrink-0 ml-2 bg-gray-100 text-gray-600 ring-gray-500/20">
                      {c.status === "Running" ? "Running" : c.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-500">Recent activity</h2>
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


        </div>
      </div>
    </div>
  );
}
