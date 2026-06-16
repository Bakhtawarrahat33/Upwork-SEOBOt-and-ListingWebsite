import { getBlogById } from "@/lib/db";
import Link from "next/link";
import ReactMarkdown from "react-markdown";

export default async function BlogDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const blog = await getBlogById(id);

  if (!blog) {
    return (
      <div className="text-center py-20">
        <div className="text-gray-300 mb-4">
          <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Blog post not found</h1>
        <Link href="/blogs" className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 mt-4 text-sm font-medium transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5m7 7l-7-7 7-7" />
          </svg>
          Back to blogs
        </Link>
      </div>
    );
  }

  const content = blog.content as string || "";

  return (
    <div className="max-w-3xl mx-auto">
      <Link href="/blogs" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600 transition-colors mb-6">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5m7 7l-7-7 7-7" />
        </svg>
        Back to blogs
      </Link>
      <article className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium bg-violet-50 text-violet-700 ring-1 ring-violet-700/10">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-500 mr-1.5" />
            Blog
          </span>
          {(blog.createdAt as string) && (
            <span className="text-xs text-gray-400">{new Date(blog.createdAt as string).toLocaleDateString()}</span>
          )}
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3 leading-tight">{blog.title as string}</h1>
        {(blog.metaDescription as string) && (
          <p className="text-lg text-gray-500 mb-8 border-b pb-6 leading-relaxed">
            {blog.metaDescription as string}
          </p>
        )}
        <div className="prose prose-gray max-w-none">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      </article>
    </div>
  );
}
