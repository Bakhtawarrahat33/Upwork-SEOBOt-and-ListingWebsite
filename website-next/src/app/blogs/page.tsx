import { getBlogs } from "@/lib/db";
import ItemCard from "@/components/ItemCard";
import { FileText, SearchX } from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function BlogsPage() {
  const blogs = await getBlogs();

  return (
    <div className="animate-fadeIn">
      <div className="flex items-center gap-3 mb-8">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-violet-50 ring-1 ring-violet-700/10">
          <FileText className="w-5 h-5 text-violet-600" />
        </div>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Blogs</h1>
          </div>
          <p className="text-gray-500 mt-0.5">Read our latest insights on automation and AI.</p>
        </div>
      </div>

      {blogs.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-20 text-center transition-colors hover:border-gray-300">
          <SearchX className="w-12 h-12 mx-auto text-gray-300" />
          <p className="text-gray-400 font-medium mt-4">No blogs found</p>
          <p className="text-gray-400 text-sm mt-1">Blogs will appear here once campaigns create them.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
          {// eslint-disable-next-line @typescript-eslint/no-explicit-any
          blogs.map((blog: any) => (
            <div key={blog.id} className="animate-slideUp">
              <ItemCard
                id={blog.id}
                title={blog.title}
                description={blog.metaDescription || blog.content?.substring(0, 100)}
                type="blogs"
                meta={blog.category}
                date={blog.createdAt ? new Date(blog.createdAt).toLocaleDateString() : undefined}
                topics={blog.topics || undefined}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
