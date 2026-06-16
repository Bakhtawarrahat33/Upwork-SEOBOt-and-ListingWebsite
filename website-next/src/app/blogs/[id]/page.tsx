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
        <h1 className="text-2xl font-bold text-gray-900">Blog post not found</h1>
        <Link href="/blogs" className="text-blue-600 hover:underline mt-4 inline-block">
          &larr; Back to blogs
        </Link>
      </div>
    );
  }

  const content = blog.content as string || "";

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link href="/blogs" className="text-sm text-blue-600 hover:underline mb-6 inline-block">
        &larr; Back to blogs
      </Link>
      <article className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-3">{blog.title as string}</h1>
        {(blog.metaDescription as string) && (
          <p className="text-lg text-gray-500 mb-8 border-b pb-6">
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
