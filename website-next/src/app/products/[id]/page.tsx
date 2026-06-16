import { getProductById } from "@/lib/db";
import Link from "next/link";
import ReactMarkdown from "react-markdown";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await getProductById(id);

  if (!product) {
    return (
      <div className="text-center py-20">
        <h1 className="text-2xl font-bold text-gray-900">Product not found</h1>
        <Link href="/products" className="text-blue-600 hover:underline mt-4 inline-block">
          &larr; Back to products
        </Link>
      </div>
    );
  }

  const content = product.content as string || "";

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link href="/products" className="text-sm text-blue-600 hover:underline mb-6 inline-block">
        &larr; Back to products
      </Link>
      <article className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-3">{product.title as string}</h1>
        {(product.description as string) && (
          <p className="text-lg text-gray-500 mb-8 border-b pb-6">
            {product.description as string}
          </p>
        )}
        <div className="prose prose-gray max-w-none">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      </article>
    </div>
  );
}
