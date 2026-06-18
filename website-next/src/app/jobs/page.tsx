import { getJobs } from "@/lib/db";
import ItemCard from "@/components/ItemCard";
import { Briefcase, SearchX } from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function JobsPage() {
  const jobs = await getJobs();

  return (
    <div className="animate-fadeIn">
      <div className="flex items-center gap-3 mb-8">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-50 ring-1 ring-blue-700/10">
          <Briefcase className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Jobs</h1>
            <span className="inline-flex items-center justify-center min-w-[1.75rem] h-6 rounded-full bg-blue-100 text-xs font-semibold text-blue-700 px-2">
              {jobs.length}
            </span>
          </div>
          <p className="text-gray-500 mt-0.5">Browse available automation and scraping job listings.</p>
        </div>
      </div>

      {jobs.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-20 text-center transition-colors hover:border-gray-300">
          <SearchX className="w-12 h-12 mx-auto text-gray-300" />
          <p className="text-gray-400 font-medium mt-4">No jobs found</p>
          <p className="text-gray-400 text-sm mt-1">Jobs will appear here once campaigns create them.</p>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 items-stretch">
          {// eslint-disable-next-line @typescript-eslint/no-explicit-any
          jobs.map((job: any) => (
            <div key={job.id} className="animate-slideUp">
              <ItemCard
                id={job.id}
                title={job.title}
                description={job.description}
                type="jobs"
                meta={job.niche || job.platform}
                date={job.createdAt ? new Date(job.createdAt).toLocaleDateString() : undefined}
                topics={job.topics || undefined}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
