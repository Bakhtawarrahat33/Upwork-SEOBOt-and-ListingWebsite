import { getServiceById } from "@/lib/db";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { ArrowLeft, Wrench, Clock } from "lucide-react";

function estimateReadingTime(content: string): number {
  const words = content.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const service = await getServiceById(id);

  if (!service) {
    return (
      <div className="text-center py-24 animate-fadeIn">
        <div className="flex items-center justify-center w-16 h-16 mx-auto rounded-2xl bg-red-50 ring-1 ring-red-700/10 mb-4">
          <Wrench className="w-8 h-8 text-red-400" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Service not found</h1>
        <p className="text-gray-400 mt-2 text-sm">The service you are looking for does not exist or has been removed.</p>
        <Link href="/services" className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 mt-6 text-sm font-medium transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to services
        </Link>
      </div>
    );
  }

  const content = service.content as string || "";

  return (
    <article className="max-w-3xl mx-auto animate-fadeIn">
      <nav className="flex items-center gap-2 text-sm text-gray-400 mb-8">
        <Link href="/" className="hover:text-gray-600 transition-colors">Home</Link>
        <span>/</span>
        <Link href="/services" className="hover:text-gray-600 transition-colors">Services</Link>
        <span>/</span>
        <span className="text-gray-600 truncate">{service.title as string}</span>
      </nav>

      <div className="flex items-center gap-3 mb-5">
        <span className="inline-flex items-center gap-1 rounded-md px-2.5 py-0.5 text-xs font-medium bg-amber-50 text-amber-700 ring-1 ring-amber-700/10">
          <Wrench className="w-3 h-3" />
          Service
        </span>
        {(service.createdAt as string) && (
          <span className="text-sm text-gray-400">{new Date(service.createdAt as string).toLocaleDateString()}</span>
        )}
        {content && (
          <span className="flex items-center gap-1 text-xs text-gray-400">
            <Clock className="w-3 h-3" />
            {estimateReadingTime(content)} min read
          </span>
        )}
      </div>

      <h1 className="text-3xl font-bold text-gray-900 leading-tight tracking-tight mb-4">{service.title as string}</h1>

      {(service.description as string) && (
        <p className="text-lg text-gray-500 mb-8 pb-8 border-b border-gray-100 leading-relaxed">
          {service.description as string}
        </p>
      )}

      <div className="prose prose-gray max-w-none">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    </article>
  );
}
