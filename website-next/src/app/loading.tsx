export default function Loading() {
  return (
    <div className="space-y-16 animate-fadeIn">
      <section className="text-center py-16">
        <div className="mx-auto w-48 h-5 rounded-full bg-gray-100 animate-pulse mb-6" />
        <div className="mx-auto w-96 h-12 rounded-lg bg-gray-100 animate-pulse mb-4" />
        <div className="mx-auto w-72 h-5 rounded-full bg-gray-100 animate-pulse mb-8" />
        <div className="flex items-center justify-center gap-3">
          <div className="w-32 h-10 rounded-xl bg-gray-100 animate-pulse" />
          <div className="w-32 h-10 rounded-xl bg-gray-100 animate-pulse" />
        </div>
      </section>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 px-5 py-5">
            <div className="w-16 h-8 rounded bg-gray-100 animate-pulse mb-2" />
            <div className="w-24 h-3 rounded bg-gray-100 animate-pulse" />
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-14">
          {[...Array(4)].map((_, i) => (
            <section key={i}>
              <div className="flex items-center justify-between mb-6">
                <div className="w-40 h-6 rounded bg-gray-100 animate-pulse" />
                <div className="w-16 h-4 rounded bg-gray-100 animate-pulse" />
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                {[...Array(2)].map((_, j) => (
                  <div key={j} className="bg-white rounded-xl border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-16 h-5 rounded bg-gray-100 animate-pulse" />
                      <div className="w-20 h-3 rounded bg-gray-100 animate-pulse" />
                    </div>
                    <div className="w-full h-4 rounded bg-gray-100 animate-pulse mb-2" />
                    <div className="w-3/4 h-4 rounded bg-gray-100 animate-pulse mb-1" />
                    <div className="w-1/2 h-4 rounded bg-gray-100 animate-pulse" />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="space-y-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="w-24 h-4 rounded bg-gray-100 animate-pulse mb-4" />
              {[...Array(3)].map((_, j) => (
                <div key={j} className="flex items-center justify-between py-2.5">
                  <div className="w-32 h-3 rounded bg-gray-100 animate-pulse" />
                  <div className="w-14 h-5 rounded bg-gray-100 animate-pulse" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
