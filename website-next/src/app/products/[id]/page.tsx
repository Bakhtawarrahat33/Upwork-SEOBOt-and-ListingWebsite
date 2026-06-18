import { getProductById } from "@/lib/db";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { ArrowLeft, Package, Clock } from "lucide-react";

function estimateReadingTime(content: string): number {
  const words = content.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await getProductById(id);

  if (!product) {
    return (
      <div className="text-center py-24 animate-fadeIn">
        <div className="flex items-center justify-center w-16 h-16 mx-auto rounded-2xl bg-red-50 ring-1 ring-red-700/10 mb-4">
          <Package className="w-8 h-8 text-red-400" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Product not found</h1>
        <p className="text-gray-400 mt-2 text-sm">The product you are looking for does not exist or has been removed.</p>
        <Link href="/products" className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 mt-6 text-sm font-medium transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to products
        </Link>
      </div>
    );
  }

  const content = product.content as string || "";

  return (
    <article className="max-w-3xl mx-auto animate-fadeIn">
      <nav className="flex items-center gap-2 text-sm text-gray-400 mb-8">
        <Link href="/" className="hover:text-gray-600 transition-colors">Home</Link>
        <span>/</span>
        <Link href="/products" className="hover:text-gray-600 transition-colors">Products</Link>
        <span>/</span>
        <span className="text-gray-600 truncate">{product.title as string}</span>
      </nav>

      <div className="flex items-center gap-3 mb-5">
        <span className="inline-flex items-center gap-1 rounded-md px-2.5 py-0.5 text-xs font-medium bg-emerald-50 text-emerald-700 ring-1 ring-emerald-700/10">
          <Package className="w-3 h-3" />
          Product
        </span>
        {(product.createdAt as string) && (
          <span className="text-sm text-gray-400">{new Date(product.createdAt as string).toLocaleDateString()}</span>
        )}
        {content && (
          <span className="flex items-center gap-1 text-xs text-gray-400">
            <Clock className="w-3 h-3" />
            {estimateReadingTime(content)} min read
          </span>
        )}
      </div>

      <h1 className="text-3xl font-bold text-gray-900 leading-tight tracking-tight mb-4">{product.title as string}</h1>

      {(product.description as string) && (
        <p className="text-lg text-gray-500 mb-8 pb-8 border-b border-gray-100 leading-relaxed">
          {product.description as string}
        </p>
      )}

      <div className="prose prose-gray max-w-none">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    </article>
  );
}
