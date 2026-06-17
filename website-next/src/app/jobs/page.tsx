import { getJobs } from "@/lib/db";
import ItemCard from "@/components/ItemCard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function JobsPage() {
  const jobs = await getJobs();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Jobs</h1>
        <p className="text-gray-500 mt-1">Browse available automation and scraping job listings.</p>
      </div>

      {jobs.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-16 text-center">
          <svg className="w-12 h-12 mx-auto text-gray-300" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z" />
          </svg>
          <p className="text-gray-400 font-medium mt-4">No jobs found</p>
          <p className="text-gray-400 text-sm mt-1">Jobs will appear here once campaigns create them.</p>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {jobs.map((job: any) => (
            <ItemCard
              key={job.id}
              id={job.id}
              title={job.title}
              description={job.description}
              type="jobs"
              meta={job.niche || job.platform}
              date={job.createdAt ? new Date(job.createdAt).toLocaleDateString() : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
