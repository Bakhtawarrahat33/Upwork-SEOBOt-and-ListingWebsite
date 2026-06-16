import { getServices } from "@/lib/db";
import ItemCard from "@/components/ItemCard";

export const revalidate = 30;

export default async function ServicesPage() {
  const services = await getServices();

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Services</h1>
          <p className="text-gray-500 mt-1">Browse available automation and integration services.</p>
        </div>
        <span className="inline-flex items-center justify-center min-w-[2.5rem] h-7 rounded-full bg-amber-100 text-sm font-bold text-amber-700 px-3">
          {services.length}
        </span>
      </div>

      {services.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-16 text-center">
          <div className="text-gray-300 mb-3">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17l-4.12 2.5 1.12-4.12L4.5 10.5l4.38-.37L11.42 6l1.54 4.13 4.38.37-3.92 3.05 1.12 4.12-4.12-2.5z" />
            </svg>
          </div>
          <p className="text-gray-400 font-medium">No services found</p>
          <p className="text-gray-400 text-sm mt-1">Services will appear here once campaigns create them.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {services.map((service: any) => (
            <ItemCard
              key={service.id}
              id={service.id}
              title={service.title}
              description={service.description}
              type="services"
              date={service.createdAt ? new Date(service.createdAt).toLocaleDateString() : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
