import { getBlogs } from "@/lib/db";
import ItemCard from "@/components/ItemCard";

export default async function BlogsPage() {
  const blogs = await getBlogs();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Blogs</h1>
        <p className="text-gray-600 mt-2">Read our latest insights on automation and AI.</p>
      </div>

      {blogs.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-12 text-center">
          <p className="text-gray-400">No blogs found.</p>
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
