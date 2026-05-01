"use client";

import { useEffect, useState, useCallback } from "react";

const IMAGE_MODELS = [
  {
    id: "imagen-4.0-generate-001",
    label: "Imagen 4 Standard",
    costPerImage: 0.04,
    description: "Best quality · $0.04/image · $0.28/story",
  },
  {
    id: "imagen-4.0-fast-generate-001",
    label: "Imagen 4 Fast",
    costPerImage: 0.02,
    description: "Lower quality · $0.02/image · $0.14/story",
  },
  {
    id: "gemini-2.5-flash-image",
    label: "Gemini 2.5 Flash Image",
    costPerImage: 0.039,
    description: "Supports reference photos · $0.039/image · $0.27/story",
  },
  {
    id: "gemini-3.1-flash-image-preview",
    label: "Gemini 3.1 Flash Image",
    costPerImage: 0.045,
    description: "Latest Gemini · $0.045+/image · $0.32+/story",
  },
] as const;

interface Stats {
  totalStories: number;
  storiesThisMonth: number;
  storiesThisWeek: number;
  storiesToday: number;
  totalUsers: number;
  currentModel: string;
  costPerStory: number;
  estimatedMonthCost: number;
  byDay: Record<string, number>;
  storyMetrics: Array<{
    storyType: string;
    storiesGenerated: number;
  }>;
  users: Array<{
    id: string;
    name: string | null;
    email: string | null;
    storiesGenerated: number;
    storyPagesGenerated: number;
    imagesGenerated: number;
    photosUploaded: number;
    totalUploadedBytes: number;
    totalCost: number;
    lastStoryGenerationDate: string | null;
  }>;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatAdminDate(dateString: string | null) {
  if (!dateString) {
    return "Never";
  }

  return new Date(dateString).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-[#FFD5C0]/60 p-5 shadow-[0_2px_12px_rgba(23,30,69,0.06)]">
      <p className="text-xs font-medium text-[#020202]/40 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-3xl font-bold text-[#171E45]">{value}</p>
      {sub && <p className="text-xs text-[#020202]/50 mt-1">{sub}</p>}
    </div>
  );
}

function ActivityBar({ day, count, max }: { day: string; count: number; max: number }) {
  const pct = max > 0 ? Math.max(4, Math.round((count / max) * 100)) : 4;
  const label = new Date(day + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return (
    <div className="flex flex-col items-center gap-1 flex-1">
      <span className="text-[10px] text-[#020202]/40 font-medium">{count > 0 ? count : ""}</span>
      <div className="w-full flex items-end justify-center" style={{ height: 60 }}>
        <div
          className="w-full rounded-t-sm bg-[#FC800A] transition-all duration-300"
          style={{ height: `${pct}%`, opacity: count > 0 ? 1 : 0.15 }}
        />
      </div>
      <span className="text-[9px] text-[#020202]/30 leading-tight text-center">{label}</span>
    </div>
  );
}

export default function AdminClient() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedModel, setSelectedModel] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/stats");
      const data = await res.json();
      if (res.ok) {
        setStats(data);
        setSelectedModel(data.currentModel);
        setFetchError(null);
      } else {
        setFetchError(`${res.status}: ${data?.error ?? "Unknown error"}`);
      }
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Fetch failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const onVisible = () => { if (document.visibilityState === "visible") fetchStats(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [fetchStats]);

  async function saveModel() {
    setSaving(true);
    setSaveStatus("idle");
    try {
      const res = await fetch("/api/admin/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelId: selectedModel }),
      });
      if (res.ok) {
        setSaveStatus("saved");
        await fetchStats();
      } else {
        setSaveStatus("error");
      }
    } catch {
      setSaveStatus("error");
    } finally {
      setSaving(false);
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  }

  // Build last-30-day chart data
  const chartDays = (() => {
    const days: { day: string; count: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      days.push({ day: key, count: stats?.byDay[key] ?? 0 });
    }
    return days;
  })();
  const maxCount = Math.max(1, ...chartDays.map((d) => d.count));

  const currentModelInfo = IMAGE_MODELS.find((m) => m.id === stats?.currentModel);
  const modelChanged = selectedModel !== stats?.currentModel;

  return (
    <div className="min-h-screen bg-[#FCF7EE]">
      <div className="mx-auto max-w-5xl px-5 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#171E45]" style={{ fontFamily: "var(--font-rowdies)" }}>
            Admin
          </h1>
          <p className="text-sm text-[#020202]/50 mt-1">Story generation usage and model configuration</p>
        </div>

        {fetchError && (
          <div className="mb-6 rounded-2xl bg-red-50 border border-red-200 px-5 py-4 text-sm text-red-700 font-mono">
            API error: {fetchError}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-[#FFD5C0]/60 p-5 h-24 animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            {/* Stats grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <StatCard label="Today" value={stats?.storiesToday ?? 0} sub={`≈ $${((stats?.storiesToday ?? 0) * (stats?.costPerStory ?? 0)).toFixed(2)}`} />
              <StatCard label="This Week" value={stats?.storiesThisWeek ?? 0} sub={`≈ $${((stats?.storiesThisWeek ?? 0) * (stats?.costPerStory ?? 0)).toFixed(2)}`} />
              <StatCard label="This Month" value={stats?.storiesThisMonth ?? 0} sub={`≈ $${(stats?.estimatedMonthCost ?? 0).toFixed(2)} est.`} />
              <StatCard label="Total Stories" value={stats?.totalStories ?? 0} sub={`${stats?.totalUsers ?? 0} users`} />
            </div>

            {/* Activity chart */}
            <div className="bg-white rounded-2xl border border-[#FFD5C0]/60 p-6 shadow-[0_2px_12px_rgba(23,30,69,0.06)] mb-6">
              <h2 className="text-sm font-semibold text-[#171E45] mb-4">Stories generated — last 30 days</h2>
              <div className="flex items-end gap-0.5" style={{ height: 80 }}>
                {chartDays.map(({ day, count }) => (
                  <ActivityBar key={day} day={day} count={count} max={maxCount} />
                ))}
              </div>
            </div>

            {/* Story metrics table */}
            <div className="bg-white rounded-2xl border border-[#FFD5C0]/60 p-6 shadow-[0_2px_12px_rgba(23,30,69,0.06)] mb-6">
              <div className="mb-4">
                <h2 className="text-sm font-semibold text-[#171E45]">Story Metrics</h2>
                <p className="text-xs text-[#020202]/40 mt-1">
                  Breakdown of generated stories by story type.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-0 text-sm">
                  <thead>
                    <tr>
                      <th className="border-b border-[#FFD5C0]/60 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[#020202]/45">Story Type</th>
                      <th className="border-b border-[#FFD5C0]/60 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[#020202]/45">Number of Stories Generated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats?.storyMetrics.length ? (
                      stats.storyMetrics.map((metric) => (
                        <tr key={metric.storyType}>
                          <td className="border-b border-[#FFD5C0]/30 px-3 py-3 text-[#171E45]">{metric.storyType}</td>
                          <td className="border-b border-[#FFD5C0]/30 px-3 py-3 text-[#171E45]">{metric.storiesGenerated}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={2} className="px-3 py-8 text-center text-sm text-[#020202]/45">
                          No story metrics found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Users table */}
            <div className="bg-white rounded-2xl border border-[#FFD5C0]/60 p-6 shadow-[0_2px_12px_rgba(23,30,69,0.06)] mb-6">
              <div className="mb-4">
                <h2 className="text-sm font-semibold text-[#171E45]">Users</h2>
                <p className="text-xs text-[#020202]/40 mt-1">
                  Per-user story, page, image, and upload usage, with estimated cost based on the active image model.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-0 text-sm">
                  <thead>
                    <tr>
                      <th className="border-b border-[#FFD5C0]/60 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[#020202]/45">User</th>
                      <th className="border-b border-[#FFD5C0]/60 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[#020202]/45">Stories Generated</th>
                      <th className="border-b border-[#FFD5C0]/60 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[#020202]/45">Story Pages</th>
                      <th className="border-b border-[#FFD5C0]/60 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[#020202]/45">Images Generated</th>
                      <th className="border-b border-[#FFD5C0]/60 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[#020202]/45">Photos Uploaded</th>
                      <th className="border-b border-[#FFD5C0]/60 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[#020202]/45">Upload Size</th>
                      <th className="border-b border-[#FFD5C0]/60 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[#020202]/45">Total Cost</th>
                      <th className="border-b border-[#FFD5C0]/60 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[#020202]/45">Last Story Generation</th>
                      <th className="border-b border-[#FFD5C0]/60 px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats?.users.length ? (
                      stats.users.map((user) => (
                        <tr key={user.id}>
                          <td className="border-b border-[#FFD5C0]/30 px-3 py-3 align-top">
                            <p className="font-medium text-[#171E45]">{user.name?.trim() || "Unnamed user"}</p>
                            <p className="text-xs text-[#020202]/45 mt-0.5">{user.email ?? "No email"}</p>
                          </td>
                          <td className="border-b border-[#FFD5C0]/30 px-3 py-3 text-[#171E45]">{user.storiesGenerated}</td>
                          <td className="border-b border-[#FFD5C0]/30 px-3 py-3 text-[#171E45]">{user.storyPagesGenerated}</td>
                          <td className="border-b border-[#FFD5C0]/30 px-3 py-3 text-[#171E45]">{user.imagesGenerated}</td>
                          <td className="border-b border-[#FFD5C0]/30 px-3 py-3 text-[#171E45]">{user.photosUploaded}</td>
                          <td className="border-b border-[#FFD5C0]/30 px-3 py-3 text-[#171E45]">{formatBytes(user.totalUploadedBytes)}</td>
                          <td className="border-b border-[#FFD5C0]/30 px-3 py-3 text-[#171E45]">${user.totalCost.toFixed(2)}</td>
                          <td className="border-b border-[#FFD5C0]/30 px-3 py-3 text-[#171E45]">{formatAdminDate(user.lastStoryGenerationDate)}</td>
                          <td className="border-b border-[#FFD5C0]/30 px-3 py-3">
                            <a href={`/admin/users/${user.id}`} className="text-xs font-medium text-[#FC800A] hover:underline underline-offset-2">
                              View →
                            </a>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="px-3 py-8 text-center text-sm text-[#020202]/45">
                          No users found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Model config */}
            <div className="bg-white rounded-2xl border border-[#FFD5C0]/60 p-6 shadow-[0_2px_12px_rgba(23,30,69,0.06)]">
              <h2 className="text-sm font-semibold text-[#171E45] mb-1">Image Generation Model</h2>
              <p className="text-xs text-[#020202]/40 mb-5">
                Active: <span className="font-medium text-[#FC800A]">{currentModelInfo?.label ?? stats?.currentModel}</span>
                {" · "}{currentModelInfo?.description}
              </p>

              <div className="space-y-3 mb-6">
                {IMAGE_MODELS.map((model) => (
                  <label
                    key={model.id}
                    className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all duration-150 ${
                      selectedModel === model.id
                        ? "border-[#FC800A] bg-[#FC800A]/5"
                        : "border-[#FFD5C0]/60 hover:border-[#FC800A]/40"
                    }`}
                  >
                    <input
                      type="radio"
                      name="model"
                      value={model.id}
                      checked={selectedModel === model.id}
                      onChange={() => setSelectedModel(model.id)}
                      className="mt-0.5 accent-[#FC800A]"
                    />
                    <div>
                      <p className="text-sm font-semibold text-[#171E45]">{model.label}</p>
                      <p className="text-xs text-[#020202]/50 mt-0.5">{model.description}</p>
                      <p className="text-xs text-[#020202]/40 font-mono mt-1">{model.id}</p>
                    </div>
                  </label>
                ))}
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={saveModel}
                  disabled={saving || !modelChanged}
                  className={`rounded-full px-6 py-2.5 text-sm font-medium transition-all duration-200
                    ${modelChanged
                      ? "bg-[#FC800A] text-white hover:bg-[#e5720a] active:scale-[0.97]"
                      : "bg-[#020202]/10 text-[#020202]/30 cursor-not-allowed"
                    }`}
                >
                  {saving ? "Saving…" : "Save Model"}
                </button>
                {saveStatus === "saved" && (
                  <span className="text-sm text-green-600 font-medium">✓ Saved — new stories will use this model</span>
                )}
                {saveStatus === "error" && (
                  <span className="text-sm text-red-500 font-medium">Failed to save. Try again.</span>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
