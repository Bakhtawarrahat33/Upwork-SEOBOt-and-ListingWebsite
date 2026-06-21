import { getBlogs, getProducts, getServices } from "@/lib/db";
import ItemCard from "@/components/ItemCard";
import { CheckCircle2, Package, SearchX } from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ProductsPage() {
  const [products, services, blogs] = await Promise.all([
    getProducts(),
    getServices(),
    getBlogs(),
  ]);
  const completeContentSets = Math.min(products.length, services.length, blogs.length);
  const waitingProducts = Math.max(products.length - completeContentSets, 0);

  return (
    <div className="animate-fadeIn">
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-50 ring-1 ring-emerald-700/10">
          <Package className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Product pages</h1>
              <span className="inline-flex items-center justify-center min-w-[1.75rem] h-6 rounded-full bg-emerald-100 text-xs font-semibold text-emerald-700 px-2">
                {products.length}
              </span>
            </div>
            <p className="text-gray-500 mt-0.5">
              Product pages are shown here. A complete set also needs one service page and one blog page.
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 lg:min-w-72">
          <div className="flex items-center gap-2 font-semibold">
            <CheckCircle2 className="h-4 w-4" />
            {completeContentSets} complete sets ready
          </div>
          <p className="mt-1 text-xs leading-5 text-emerald-800">
            {products.length} product pages, {services.length} service pages, and {blogs.length} blog pages.
          </p>
          {waitingProducts > 0 && (
            <p className="mt-2 rounded-md bg-white/70 px-2 py-1.5 text-xs leading-5 text-amber-800">
              {waitingProducts} product page{waitingProducts === 1 ? "" : "s"} waiting for matching service/blog pages.
            </p>
          )}
        </div>
      </div>

      {products.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-20 text-center transition-colors hover:border-gray-300">
          <SearchX className="w-12 h-12 mx-auto text-gray-300" />
          <p className="text-gray-400 font-medium mt-4">No products found</p>
          <p className="text-gray-400 text-sm mt-1">Products will appear here once campaigns create them.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
          {// eslint-disable-next-line @typescript-eslint/no-explicit-any
          products.map((product: any) => (
            <div key={product.id} className="animate-slideUp">
              <ItemCard
                id={product.id}
                title={product.title}
                description={product.description}
                type="products"
                date={product.createdAt ? new Date(product.createdAt).toLocaleDateString() : undefined}
                topics={product.topics || undefined}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
