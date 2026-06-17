import { getServiceById } from "@/lib/db";
import Link from "next/link";
import ReactMarkdown from "react-markdown";

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const service = await getServiceById(id);

  if (!service) {
    return (
      <div className="text-center py-20">
        <svg className="w-16 h-16 mx-auto text-gray-300" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h1 className="text-2xl font-bold text-gray-900 mt-4">Service not found</h1>
        <Link href="/services" className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 mt-4 text-sm font-medium transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5m7 7l-7-7 7-7" />
          </svg>
          Back to services
        </Link>
      </div>
    );
  }

  const content = service.content as string || "";

  return (
    <article className="max-w-3xl mx-auto">
      <Link href="/services" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 transition-colors mb-8">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5m7 7l-7-7 7-7" />
        </svg>
        Back to services
      </Link>
      <div className="flex items-center gap-3 mb-4">
        <span className="inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-medium bg-amber-50 text-amber-700 ring-1 ring-amber-700/10">
          Service
        </span>
        {(service.createdAt as string) && (
          <span className="text-sm text-gray-400">{new Date(service.createdAt as string).toLocaleDateString()}</span>
        )}
      </div>
      <h1 className="text-3xl font-bold text-gray-900 leading-tight mb-4">{service.title as string}</h1>
      {(service.description as string) && (
        <p className="text-lg text-gray-500 mb-8 pb-8 border-b border-gray-200 leading-relaxed">
          {service.description as string}
        </p>
      )}
      <div className="prose prose-gray max-w-none">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    </article>
  );
}
