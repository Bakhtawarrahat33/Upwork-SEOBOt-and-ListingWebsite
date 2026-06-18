import { getJobById } from "@/lib/db";
import Link from "next/link";
import { ArrowLeft, Briefcase, ExternalLink } from "lucide-react";

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await getJobById(id);

  if (!job) {
    return (
      <div className="text-center py-24 animate-fadeIn">
        <div className="flex items-center justify-center w-16 h-16 mx-auto rounded-2xl bg-red-50 ring-1 ring-red-700/10 mb-4">
          <Briefcase className="w-8 h-8 text-red-400" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Job not found</h1>
        <p className="text-gray-400 mt-2 text-sm">The job you are looking for does not exist or has been removed.</p>
        <Link href="/jobs" className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 mt-6 text-sm font-medium transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to jobs
        </Link>
      </div>
    );
  }

  return (
    <article className="max-w-3xl mx-auto animate-fadeIn">
      <nav className="flex items-center gap-2 text-sm text-gray-400 mb-8">
        <Link href="/" className="hover:text-gray-600 transition-colors">Home</Link>
        <span>/</span>
        <Link href="/jobs" className="hover:text-gray-600 transition-colors">Jobs</Link>
        <span>/</span>
        <span className="text-gray-600 truncate">{job.title as string}</span>
      </nav>

      <div className="flex items-center gap-3 mb-5">
        <span className="inline-flex items-center gap-1 rounded-md px-2.5 py-0.5 text-xs font-medium bg-blue-50 text-blue-700 ring-1 ring-blue-700/10">
          <Briefcase className="w-3 h-3" />
          Job
        </span>
        {(job.createdAt as string) && (
          <span className="text-sm text-gray-400">{new Date(job.createdAt as string).toLocaleDateString()}</span>
        )}
      </div>

      <h1 className="text-3xl font-bold text-gray-900 leading-tight tracking-tight mb-6">{job.title as string}</h1>

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
        <div className="mt-10 pt-8 border-t border-gray-100">
          <a
            href={job.upworkJobUrl as string}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 shadow-sm"
          >
            <ExternalLink className="w-4 h-4" />
            View on Upwork
          </a>
        </div>
      )}
    </article>
  );
}
