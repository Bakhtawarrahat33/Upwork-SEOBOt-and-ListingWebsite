import { getProducts } from "@/lib/db";
import ItemCard from "@/components/ItemCard";
import { Package, SearchX } from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ProductsPage() {
  const products = await getProducts();

  return (
    <div className="animate-fadeIn">
      <div className="flex items-center gap-3 mb-8">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-50 ring-1 ring-emerald-700/10">
          <Package className="w-5 h-5 text-emerald-600" />
        </div>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Products</h1>
            <span className="inline-flex items-center justify-center min-w-[1.75rem] h-6 rounded-full bg-emerald-100 text-xs font-semibold text-emerald-700 px-2">
              {products.length}
            </span>
          </div>
          <p className="text-gray-500 mt-0.5">Browse automation tools and product listings.</p>
        </div>
      </div>

      {products.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-20 text-center transition-colors hover:border-gray-300">
          <SearchX className="w-12 h-12 mx-auto text-gray-300" />
          <p className="text-gray-400 font-medium mt-4">No products found</p>
          <p className="text-gray-400 text-sm mt-1">Products will appear here once campaigns create them.</p>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 items-stretch">
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
