import { getProducts } from "@/lib/db";
import ItemCard from "@/components/ItemCard";

export default async function ProductsPage() {
  const products = await getProducts();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Products</h1>
        <p className="text-gray-600 mt-2">Browse automation tools and product listings.</p>
      </div>

      {products.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-12 text-center">
          <p className="text-gray-400">No products found.</p>
          <p className="text-gray-400 text-sm mt-1">Products will appear here once campaigns create them.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {products.map((product: any) => (
            <ItemCard
              key={product.id}
              id={product.id}
              title={product.title}
              description={product.description}
              type="products"
              date={product.createdAt ? new Date(product.createdAt).toLocaleDateString() : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
