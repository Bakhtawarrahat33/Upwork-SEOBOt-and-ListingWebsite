"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { Briefcase, Package, Wrench, FileText, Eye, Edit3, Loader2 } from "lucide-react";

const tabs = [
  { key: "job", label: "Job", icon: Briefcase, endpoint: "/api/jobs" },
  { key: "product", label: "Product", icon: Package, endpoint: "/api/products" },
  { key: "service", label: "Service", icon: Wrench, endpoint: "/api/services" },
  { key: "blog", label: "Blog", icon: FileText, endpoint: "/api/blogs" },
];

export default function PostPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("job");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [previewField, setPreviewField] = useState<string | null>(null);

  const [form, setForm] = useState<Record<string, string>>({});

  const currentTab = tabs.find((t) => t.key === activeTab)!;

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    const fields = fieldsConfig[activeTab];
    for (const field of fields) {
      const val = (form[field.label] || "").trim();
      if (!val) {
        newErrors[field.label] = `${field.label.replace(/([A-Z])/g, " $1")} is required`;
      } else if (field.label === "title" && val.length < 3) {
        newErrors[field.label] = "Title must be at least 3 characters";
      } else if (field.label === "content" && val.length < 20) {
        newErrors[field.label] = "Content must be at least 20 characters";
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

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
      setMessageType("success");
      setMessage("Created successfully!");
      setForm({});
      setErrors({});
      setTimeout(() => {
        router.push(`/${activeTab}s/${data.id}`);
      }, 800);
    } catch (err: unknown) {
      setMessageType("error");
      setMessage(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const fieldsConfig: Record<string, { label: string; type?: string; rows?: number }[]> = {
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

  const fields = fieldsConfig[activeTab];

  return (
    <div className="max-w-2xl mx-auto animate-fadeIn">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Post a Listing</h1>
        <p className="text-gray-500 mt-1">Create a new job, product, service, or blog listing.</p>
      </div>

      <div className="flex gap-2 mb-6">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key);
                setForm({});
                setMessage("");
                setErrors({});
                setPreviewField(null);
              }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                active
                  ? "bg-gray-900 text-white shadow-sm"
                  : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-200"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-xl text-sm font-medium flex items-center gap-2 animate-slideDown ${
          messageType === "success"
            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
            : "bg-red-50 text-red-700 border border-red-200"
        }`}>
          {messageType === "success" ? (
            <div className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-200 text-emerald-700 text-xs font-bold">✓</div>
          ) : (
            <div className="flex items-center justify-center w-5 h-5 rounded-full bg-red-200 text-red-700 text-xs font-bold">!</div>
          )}
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {fields.map((field) => {
          const isContent = field.label === "content";
          const showPreview = previewField === field.label;
          const charCount = (form[field.label] || "").length;

          return (
            <div key={field.label}>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-gray-700 capitalize">
                  {field.label.replace(/([A-Z])/g, " $1")}
                </label>
                {field.rows && (
                  <span className={`text-xs ${errors[field.label] ? 'text-red-400' : 'text-gray-400'}`}>
                    {charCount} chars
                  </span>
                )}
              </div>

              {field.rows ? (
                <div className="space-y-2">
                  {isContent && (
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => setPreviewField(showPreview ? null : field.label)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                          showPreview
                            ? "bg-blue-100 text-blue-700"
                            : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                        }`}
                      >
                        {showPreview ? (
                          <><Edit3 className="w-3 h-3" /> Edit</>
                        ) : (
                          <><Eye className="w-3 h-3" /> Preview</>
                        )}
                      </button>
                    </div>
                  )}
                  {showPreview && isContent ? (
                    <div className="min-h-[200px] p-4 rounded-xl border border-gray-200 bg-white prose prose-gray max-w-none text-sm">
                      <ReactMarkdown>{form[field.label] || "*Nothing to preview*"}</ReactMarkdown>
                    </div>
                  ) : (
                    <textarea
                      value={form[field.label] || ""}
                      onChange={(e) => handleChange(field.label, e.target.value)}
                      rows={field.rows}
                      className={`w-full px-4 py-2.5 rounded-xl border text-sm transition outline-none ${
                        errors[field.label]
                          ? "border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-100"
                          : "border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      }`}
                      required
                    />
                  )}
                </div>
              ) : (
                <input
                  type={field.type || "text"}
                  value={form[field.label] || ""}
                  onChange={(e) => handleChange(field.label, e.target.value)}
                  className={`w-full px-4 py-2.5 rounded-xl border text-sm transition outline-none ${
                    errors[field.label]
                      ? "border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-100"
                      : "border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  }`}
                  required
                />
              )}
              {errors[field.label] && (
                <p className="text-xs text-red-500 mt-1.5">{errors[field.label]}</p>
              )}
            </div>
          );
        })}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl bg-gray-900 text-white font-medium hover:bg-gray-800 disabled:opacity-50 transition-all duration-200 shadow-sm hover:shadow-md"
        >
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Creating...
            </span>
          ) : (
            `Create ${currentTab.label}`
          )}
        </button>
      </form>
    </div>
  );
}
