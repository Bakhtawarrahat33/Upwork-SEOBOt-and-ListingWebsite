"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const tabs = [
  { key: "job", label: "Job", endpoint: "/api/jobs" },
  { key: "product", label: "Product", endpoint: "/api/products" },
  { key: "service", label: "Service", endpoint: "/api/services" },
  { key: "blog", label: "Blog", endpoint: "/api/blogs" },
];

export default function PostPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("job");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const [form, setForm] = useState<Record<string, string>>({});

  const currentTab = tabs.find((t) => t.key === activeTab)!;

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const res = await fetch(currentTab.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) throw new Error("Failed to create");

      const data = await res.json();
      setMessage("✅ Created successfully!");
      setForm({});
      setTimeout(() => {
        router.push(`/${activeTab}s/${data.id}`);
      }, 800);
    } catch (err: any) {
      setMessage(`❌ Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const fields: Record<string, { label: string; type?: string; rows?: number }[]> = {
    job: [
      { label: "title" },
      { label: "description", rows: 4 },
      { label: "niche" },
      { label: "platform" },
      { label: "tool" },
      { label: "upworkJobUrl" },
    ],
    product: [
      { label: "title" },
      { label: "description", rows: 2 },
      { label: "content", rows: 6 },
    ],
    service: [
      { label: "title" },
      { label: "description", rows: 2 },
      { label: "content", rows: 6 },
    ],
    blog: [
      { label: "title" },
      { label: "content", rows: 8 },
    ],
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Post a Listing</h1>
        <p className="text-gray-500 mt-1">Create a new job, product, service, or blog listing.</p>
      </div>

      <div className="flex gap-2 mb-6 border-b border-gray-200 pb-4">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              setActiveTab(tab.key);
              setForm({});
              setMessage("");
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.key
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {message && (
        <div className={`mb-4 p-4 rounded-xl text-sm font-medium ${
          message.startsWith("✅") ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"
        }`}>
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {fields[activeTab].map((field) => (
          <div key={field.label}>
            <label className="block text-sm font-medium text-gray-700 mb-1.5 capitalize">
              {field.label.replace(/([A-Z])/g, " $1")}
            </label>
            {field.rows ? (
              <textarea
                value={form[field.label] || ""}
                onChange={(e) => handleChange(field.label, e.target.value)}
                rows={field.rows}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition text-sm"
                required
              />
            ) : (
              <input
                type={field.type || "text"}
                value={form[field.label] || ""}
                onChange={(e) => handleChange(field.label, e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition text-sm"
                required
              />
            )}
          </div>
        ))}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 transition shadow-sm"
        >
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Creating...
            </span>
          ) : `Create ${currentTab.label}`}
        </button>
      </form>
    </div>
  );
}
