import { getJobs } from "@/lib/db";
import ItemCard from "@/components/ItemCard";

export default async function JobsPage() {
  const jobs = await getJobs();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Jobs</h1>
        <p className="text-gray-600 mt-2">Browse available automation and scraping job listings.</p>
      </div>

      {jobs.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-12 text-center">
          <p className="text-gray-400">No jobs found.</p>
          <p className="text-gray-400 text-sm mt-1">Jobs will appear here once campaigns create them.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
