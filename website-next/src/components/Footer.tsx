import Link from "next/link";
import { Briefcase, Package, Wrench, FileText } from "lucide-react";

const categories = [
  { href: "/jobs", label: "Jobs", icon: Briefcase, desc: "Automation & scraping jobs" },
  { href: "/products", label: "Products", icon: Package, desc: "AI-powered tools" },
  { href: "/services", label: "Services", icon: Wrench, desc: "Integration solutions" },
  { href: "/blogs", label: "Blogs", icon: FileText, desc: "Insights & guides" },
];

export default function Footer() {
  return (
    <footer className="w-full bg-white border-t border-slate-200/60 mt-16">
      <div className="h-1 bg-gradient-to-r from-blue-500 via-emerald-500 to-violet-500" />

      <div className="mx-auto max-w-[1400px] px-6 py-12 lg:py-16">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4 items-start">

          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-2.5 group">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 text-xs font-bold text-white shadow-sm transition-transform duration-200 group-hover:scale-105">
                A
              </span>
              <span className="font-bold tracking-tight text-slate-900 text-sm">
                Automation Listings
              </span>
            </Link>
            <p className="text-xs text-slate-500 leading-relaxed max-w-xs">
              Curated automation jobs, products, services, and insights powered by AI-driven campaigns.
            </p>
            <Link
              href="/post"
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
            >
              Post a listing <span className="text-[10px]">&rarr;</span>
            </Link>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-4">
              Quick Links
            </h4>
            <ul className="space-y-2.5 text-xs">
              <li>
                <Link href="/" className="text-slate-500 hover:text-blue-600 font-medium transition-colors">
                  Home
                </Link>
              </li>
              <li>
                <Link href="/post" className="text-slate-500 hover:text-blue-600 font-medium transition-colors">
                  Create Listing
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-4">
              Categories
            </h4>
            <ul className="space-y-3">
              {categories.map(({ href, label, icon: Icon, desc }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="group flex items-start gap-3"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-50 border border-slate-100 text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 group-hover:border-blue-100 transition-colors">
                      <Icon className="w-3 h-3" />
                    </span>
                    <div>
                      <span className="block text-xs font-semibold text-slate-800 group-hover:text-blue-600 transition-colors">
                        {label}
                      </span>
                      <span className="block text-[11px] text-slate-400 mt-0.5">{desc}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-4">
              Resources
            </h4>
            <ul className="space-y-2.5 text-xs">
              <li>
                <a href="#" className="text-slate-500 hover:text-blue-600 font-medium transition-colors">
                  Documentation
                </a>
              </li>
              <li>
                <a href="#" className="text-slate-500 hover:text-blue-600 font-medium transition-colors">
                  API Reference
                </a>
              </li>
              <li>
                <a href="#" className="text-slate-500 hover:text-blue-600 font-medium transition-colors">
                  Support
                </a>
              </li>
            </ul>
          </div>

        </div>

        <div className="mt-12 pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-medium text-slate-400">
          <p>&copy; {new Date().getFullYear()} Automation Listings. All rights reserved.</p>
          <p className="flex items-center gap-1">
            Built with <span className="text-slate-600 font-semibold">Next.js</span> &bull; Powered by <span className="text-slate-600 font-semibold">AI</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
