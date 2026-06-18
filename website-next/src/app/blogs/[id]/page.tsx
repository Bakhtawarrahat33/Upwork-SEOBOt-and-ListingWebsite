import { getBlogById } from "@/lib/db";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { ArrowLeft, FileText, Clock } from "lucide-react";

function estimateReadingTime(content: string): number {
  const words = content.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}

export default async function BlogDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const blog = await getBlogById(id);

  if (!blog) {
    return (
      <div className="text-center py-24 animate-fadeIn">
        <div className="flex items-center justify-center w-16 h-16 mx-auto rounded-2xl bg-red-50 ring-1 ring-red-700/10 mb-4">
          <FileText className="w-8 h-8 text-red-400" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Blog post not found</h1>
        <p className="text-gray-400 mt-2 text-sm">The blog post you are looking for does not exist or has been removed.</p>
        <Link href="/blogs" className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 mt-6 text-sm font-medium transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to blogs
        </Link>
      </div>
    );
  }

  const content = blog.content as string || "";
  const readingTime = estimateReadingTime(content);

  return (
    <article className="max-w-3xl mx-auto animate-fadeIn">
      <nav className="flex items-center gap-2 text-sm text-gray-400 mb-8">
        <Link href="/" className="hover:text-gray-600 transition-colors">Home</Link>
        <span>/</span>
        <Link href="/blogs" className="hover:text-gray-600 transition-colors">Blogs</Link>
        <span>/</span>
        <span className="text-gray-600 truncate">{blog.title as string}</span>
      </nav>

      <div className="flex items-center gap-3 mb-5">
        <span className="inline-flex items-center gap-1 rounded-md px-2.5 py-0.5 text-xs font-medium bg-violet-50 text-violet-700 ring-1 ring-violet-700/10">
          <FileText className="w-3 h-3" />
          Blog
        </span>
        {(blog.createdAt as string) && (
          <span className="text-sm text-gray-400">{new Date(blog.createdAt as string).toLocaleDateString()}</span>
        )}
        {content && (
          <span className="flex items-center gap-1 text-xs text-gray-400">
            <Clock className="w-3 h-3" />
            {readingTime} min read
          </span>
        )}
      </div>

      <h1 className="text-3xl font-bold text-gray-900 leading-tight tracking-tight mb-4">{blog.title as string}</h1>

      {(blog.metaDescription as string) && (
        <p className="text-lg text-gray-500 mb-8 pb-8 border-b border-gray-100 leading-relaxed">
          {blog.metaDescription as string}
        </p>
      )}

      <div className="prose prose-gray max-w-none">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    </article>
  );
}
