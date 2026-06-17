import { getJobById } from "@/lib/db";
import Link from "next/link";

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await getJobById(id);

  if (!job) {
    return (
      <div className="text-center py-20">
        <svg className="w-16 h-16 mx-auto text-gray-300" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h1 className="text-2xl font-bold text-gray-900 mt-4">Job not found</h1>
        <Link href="/jobs" className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 mt-4 text-sm font-medium transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5m7 7l-7-7 7-7" />
          </svg>
          Back to jobs
        </Link>
      </div>
    );
  }

  return (
    <article className="max-w-3xl mx-auto">
      <Link href="/jobs" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 transition-colors mb-8">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5m7 7l-7-7 7-7" />
        </svg>
        Back to jobs
      </Link>
      <div className="flex items-center gap-3 mb-4">
        <span className="inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-medium bg-blue-50 text-blue-700 ring-1 ring-blue-700/10">
          Job
        </span>
        {(job.createdAt as string) && (
          <span className="text-sm text-gray-400">{new Date(job.createdAt as string).toLocaleDateString()}</span>
        )}
      </div>
      <h1 className="text-3xl font-bold text-gray-900 leading-tight mb-6">{job.title as string}</h1>
      <div className="flex flex-wrap gap-2 mb-8">
        {(job.niche as string) && (
          <span className="inline-flex items-center rounded-md bg-gray-100 px-2.5 py-0.5 text-sm font-medium text-gray-600">
            {job.niche as string}
          </span>
        )}
        {(job.platform as string) && (
          <span className="inline-flex items-center rounded-md bg-gray-100 px-2.5 py-0.5 text-sm font-medium text-gray-600">
            {job.platform as string}
          </span>
        )}
        {(job.tool as string) && (
          <span className="inline-flex items-center rounded-md bg-gray-100 px-2.5 py-0.5 text-sm font-medium text-gray-600">
            {job.tool as string}
          </span>
        )}
      </div>
      <div className="prose prose-gray max-w-none">
        <p>{(job.description as string) || "No description provided."}</p>
      </div>
      {(job.upworkJobUrl as string) && (
        <a
          href={job.upworkJobUrl as string}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 mt-8 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          View on Upwork
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
          </svg>
        </a>
      )}
    </article>
  );
}
