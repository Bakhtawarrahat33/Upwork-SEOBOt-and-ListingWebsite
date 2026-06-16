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
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Post a Listing</h1>

      <div className="flex gap-2 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              setActiveTab(tab.key);
              setForm({});
              setMessage("");
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {message && (
        <div className="mb-4 p-3 rounded-lg bg-gray-50 text-sm">{message}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {fields[activeTab].map((field) => (
          <div key={field.label}>
            <label className="block text-sm font-medium text-gray-700 mb-1 capitalize">
              {field.label.replace(/([A-Z])/g, " $1")}
            </label>
            {field.rows ? (
              <textarea
                value={form[field.label] || ""}
                onChange={(e) => handleChange(field.label, e.target.value)}
                rows={field.rows}
                className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition"
                required
              />
            ) : (
              <input
                type={field.type || "text"}
                value={form[field.label] || ""}
                onChange={(e) => handleChange(field.label, e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition"
                required
              />
            )}
          </div>
        ))}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 transition"
        >
          {loading ? "Creating..." : `Create ${currentTab.label}`}
        </button>
      </form>
    </div>
  );
}
