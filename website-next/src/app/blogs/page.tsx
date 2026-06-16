import { getBlogs } from "@/lib/db";
import ItemCard from "@/components/ItemCard";

export const revalidate = 30;

export default async function BlogsPage() {
  const blogs = await getBlogs();

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Blogs</h1>
          <p className="text-gray-500 mt-1">Read our latest insights on automation and AI.</p>
        </div>
        <span className="inline-flex items-center justify-center min-w-[2.5rem] h-7 rounded-full bg-violet-100 text-sm font-bold text-violet-700 px-3">
          {blogs.length}
        </span>
      </div>

      {blogs.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-16 text-center">
          <div className="text-gray-300 mb-3">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
            </svg>
          </div>
          <p className="text-gray-400 font-medium">No blogs found</p>
          <p className="text-gray-400 text-sm mt-1">Blogs will appear here once campaigns create them.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {blogs.map((blog: any) => (
            <ItemCard
              key={blog.id}
              id={blog.id}
              title={blog.title}
              description={blog.metaDescription || blog.content?.substring(0, 100)}
              type="blogs"
              meta={blog.category}
              date={blog.createdAt ? new Date(blog.createdAt).toLocaleDateString() : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
