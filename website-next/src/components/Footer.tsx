import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t bg-white mt-16">
      <div className="max-w-7xl mx-auto px-4 py-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2 text-lg font-bold text-blue-700 mb-2">
              <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 text-white text-xs font-bold">
                A
              </span>
              <span>Automation Listings</span>
            </Link>
            <p className="text-sm text-gray-500 leading-relaxed">
              Curated automation jobs, products, services, and insights.
            </p>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-gray-900 uppercase tracking-wider mb-3">Browse</h4>
            <div className="space-y-2">
              {["Jobs", "Products", "Services", "Blogs"].map((item) => (
                <Link
                  key={item}
                  href={`/${item.toLowerCase()}`}
                  className="block text-sm text-gray-500 hover:text-blue-600 transition-colors"
                >
                  {item}
                </Link>
              ))}
            </div>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-gray-900 uppercase tracking-wider mb-3">Contribute</h4>
            <div className="space-y-2">
              <Link href="/post" className="block text-sm text-gray-500 hover:text-blue-600 transition-colors">
                Post a Listing
              </Link>
            </div>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-gray-900 uppercase tracking-wider mb-3">Info</h4>
            <div className="space-y-2">
              <span className="block text-sm text-gray-500">
                &copy; {new Date().getFullYear()}
              </span>
            </div>
          </div>
        </div>
        <div className="border-t border-gray-100 pt-6 text-center text-xs text-gray-400">
          Built with Next.js &middot; Powered by AI Automation
        </div>
      </div>
    </footer>
  );
}
