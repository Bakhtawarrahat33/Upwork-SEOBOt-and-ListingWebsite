export default function Footer() {
  return (
    <footer className="border-t bg-white mt-16">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-sm text-gray-500">
            &copy; {new Date().getFullYear()} Automation Listings. All rights reserved.
          </div>
          <div className="flex gap-6 text-sm text-gray-500">
            <span className="hover:text-gray-800 transition-colors cursor-default">Jobs</span>
            <span className="hover:text-gray-800 transition-colors cursor-default">Products</span>
            <span className="hover:text-gray-800 transition-colors cursor-default">Services</span>
            <span className="hover:text-gray-800 transition-colors cursor-default">Blogs</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
