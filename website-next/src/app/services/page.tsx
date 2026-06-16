import { getServices } from "@/lib/db";
import ItemCard from "@/components/ItemCard";

export default async function ServicesPage() {
  const services = await getServices();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Services</h1>
        <p className="text-gray-600 mt-2">Browse available automation and integration services.</p>
      </div>

      {services.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-12 text-center">
          <p className="text-gray-400">No services found.</p>
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
