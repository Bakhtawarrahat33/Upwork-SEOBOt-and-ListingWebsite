import { getJobById } from "@/lib/db";
import Link from "next/link";

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await getJobById(id);

  if (!job) {
    return (
      <div className="text-center py-20">
        <h1 className="text-2xl font-bold text-gray-900">Job not found</h1>
        <Link href="/jobs" className="text-blue-600 hover:underline mt-4 inline-block">
          &larr; Back to jobs
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <Link href="/jobs" className="text-sm text-blue-600 hover:underline mb-6 inline-block">
        &larr; Back to jobs
      </Link>
      <article className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">{job.title as string}</h1>
        <div className="flex flex-wrap gap-2 mb-6">
          {(job.niche as string) && (
            <span className="px-3 py-1 bg-blue-50 text-blue-700 text-sm rounded-full">{job.niche as string}</span>
          )}
          {(job.platform as string) && (
            <span className="px-3 py-1 bg-green-50 text-green-700 text-sm rounded-full">{job.platform as string}</span>
          )}
          {(job.tool as string) && (
            <span className="px-3 py-1 bg-purple-50 text-purple-700 text-sm rounded-full">{job.tool as string}</span>
          )}
        </div>
        <div className="prose max-w-none text-gray-700 whitespace-pre-wrap">
          {(job.description as string) || "No description provided."}
        </div>
        {(job.upworkJobUrl as string) && (
          <a
            href={job.upworkJobUrl as string}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex items-center text-blue-600 hover:underline"
          >
            View on Upwork &rarr;
          </a>
        )}
      </article>
    </div>
  );
}
