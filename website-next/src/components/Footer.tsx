import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-white mt-16">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <Link href="/" className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <span className="flex items-center justify-center w-6 h-6 rounded bg-blue-600 text-white text-[10px] font-bold">
              A
            </span>
            Automation Listings
          </Link>
          <div className="flex items-center gap-6 text-sm text-gray-400">
            <Link href="/jobs" className="hover:text-gray-600 transition-colors">Jobs</Link>
            <Link href="/products" className="hover:text-gray-600 transition-colors">Products</Link>
            <Link href="/services" className="hover:text-gray-600 transition-colors">Services</Link>
            <Link href="/blogs" className="hover:text-gray-600 transition-colors">Blogs</Link>
          </div>
        </div>
        <div className="mt-6 pt-6 border-t border-gray-100 text-center text-xs text-gray-400">
          &copy; {new Date().getFullYear()} Automation Listings. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
