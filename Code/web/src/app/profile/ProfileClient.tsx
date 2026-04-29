"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";

interface StoryItem {
  id: string;
  title: string;
  coverText: string;
  theme: string;
  childName: string;
  coverImageUrl: string | null;
  thumbnailUrl: string | null;
  createdAt: string;
}

interface PhotoItem {
  id: string;
  url: string;
  filename: string;
  createdAt: string;
}

interface User {
  name: string | null;
  email: string | null;
  image: string | null;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function ProfileClient({
  user,
  stories,
  photos,
}: {
  user: User;
  stories: StoryItem[];
  photos: PhotoItem[];
}) {
  const router = useRouter();
  const [storyList, setStoryList] = useState(stories);
  const [deletingStoryId, setDeletingStoryId] = useState<string | null>(null);
  const initial = user.name?.[0]?.toUpperCase() ?? user.email?.[0]?.toUpperCase() ?? "?";

  const handleDeleteStory = async (storyId: string, storyTitle: string) => {
    const confirmed = window.confirm(`Delete "${storyTitle}" from your library?`);
    if (!confirmed) return;

    setDeletingStoryId(storyId);
    try {
      const response = await fetch(`/api/stories/${storyId}`, { method: "DELETE" });
      if (!response.ok) {
        throw new Error("Failed to delete story");
      }
      setStoryList((current) => current.filter((story) => story.id !== storyId));
    } catch {
      window.alert("Could not delete that story. Please try again.");
    } finally {
      setDeletingStoryId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#FCF7EE]">
      {/* ── Profile header ─────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-b from-[#FBF1E3] to-[#FCF7EE] border-b border-[#FFD5C0]/60">
        <div className="mx-auto max-w-4xl px-5 py-12">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            {user.image ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={user.image}
                alt={user.name ?? "Profile"}
                className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-[0_4px_20px_rgba(23,30,69,0.12)]"
                width={80}
                height={80}
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-[#FC800A] text-white text-2xl font-bold flex items-center justify-center border-4 border-white shadow-[0_4px_20px_rgba(252,128,10,0.3)]">
                {initial}
              </div>
            )}
            <div className="flex-1 text-center sm:text-left">
              <h1
                className="text-3xl text-[#171E45] leading-tight"
                style={{ fontFamily: "var(--font-rowdies)" }}
              >
                {user.name ?? "My Profile"}
              </h1>
              <p className="text-sm text-[#020202]/50 mt-1">{user.email}</p>
              <div className="flex items-center justify-center sm:justify-start gap-6 mt-4">
                <div className="text-center">
                  <p className="text-xl font-bold text-[#171E45]">{storyList.length}</p>
                  <p className="text-xs text-[#020202]/40">Stories</p>
                </div>
                <div className="w-px h-8 bg-[#FFD5C0]" aria-hidden="true" />
                <div className="text-center">
                  <p className="text-xl font-bold text-[#171E45]">{photos.length}</p>
                  <p className="text-xs text-[#020202]/40">Photos</p>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => router.push("/create")}
                className="rounded-full bg-[#FC800A] text-white px-5 py-2.5 text-sm font-semibold
                           shadow-[0_4px_14px_rgba(252,128,10,0.35)]
                           hover:bg-[#e5720a] hover:-translate-y-0.5
                           focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FC800A]
                           active:scale-[0.97] transition-all duration-200"
              >
                + New Story
              </button>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/" })}
                className="rounded-full border border-[#020202]/15 bg-white px-5 py-2.5 text-sm font-medium text-[#020202]/60
                           hover:border-[#020202]/30 hover:text-[#020202]
                           focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FC800A]
                           active:scale-[0.97] transition-all duration-200"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-5 py-12 flex flex-col gap-16">

        {/* ── My Stories ───────────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2
              className="text-2xl text-[#171E45]"
              style={{ fontFamily: "var(--font-rowdies)" }}
            >
              My Stories
            </h2>
            {storyList.length > 0 && (
              <span className="text-xs text-[#020202]/40 bg-[#FBF1E3] rounded-full px-3 py-1 border border-[#FFD5C0]">
                {storyList.length} saved
              </span>
            )}
          </div>

          {storyList.length === 0 ? (
            <div className="rounded-3xl border-2 border-dashed border-[#FFD5C0] bg-[#FBF1E3]/50 py-16 text-center">
              <p className="text-4xl mb-4" aria-hidden="true">📖</p>
              <p className="text-base font-semibold text-[#171E45]/70 mb-1">No stories yet</p>
              <p className="text-sm text-[#020202]/40 mb-6">Create your first story and it will appear here</p>
              <button
                type="button"
                onClick={() => router.push("/create")}
                className="rounded-full bg-[#FC800A] text-white px-6 py-3 text-sm font-semibold
                           shadow-[0_4px_14px_rgba(252,128,10,0.35)]
                           hover:bg-[#e5720a] active:scale-[0.97] transition-all duration-200"
              >
                Create a Story
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {storyList.map((story) => (
                <article
                  key={story.id}
                  className="group rounded-3xl bg-white border border-[#FFD5C0]/60 overflow-hidden text-left
                             shadow-[0_2px_12px_rgba(23,30,69,0.06)]
                             hover:shadow-[0_8px_28px_rgba(23,30,69,0.12)] hover:-translate-y-1
                             transition-all duration-200"
                >
                  <div className="p-3 pb-0 flex items-start justify-end">
                    <button
                      type="button"
                      onClick={() => void handleDeleteStory(story.id, story.title)}
                      disabled={deletingStoryId === story.id}
                      className="rounded-full border border-[#FFD5C0] bg-white/90 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#171E45]/70
                                 hover:border-[#FC800A]/40 hover:text-[#171E45]
                                 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FC800A]
                                 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {deletingStoryId === story.id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => router.push(`/story/${story.id}`)}
                    className="w-full text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FC800A]"
                  >
                  {/* Cover image */}
                  <div className="w-full aspect-[4/3] bg-gradient-to-br from-[#FBF1E3] to-[#FFE8D0] overflow-hidden relative">
                    {story.thumbnailUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={story.thumbnailUrl}
                        alt={story.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-4xl opacity-30">
                        📖
                      </div>
                    )}
                    <div
                      className="absolute inset-x-0 bottom-0 h-12"
                      style={{ background: "linear-gradient(to top, rgba(255,251,246,0.9), transparent)" }}
                      aria-hidden="true"
                    />
                  </div>

                  <div className="p-4">
                    <span className="inline-block text-[10px] font-semibold text-[#FC800A] tracking-wider uppercase mb-2 bg-[#FC800A]/10 rounded-full px-2.5 py-0.5">
                      {story.theme}
                    </span>
                    <h3 className="text-sm font-semibold text-[#171E45] leading-snug line-clamp-2 mb-1">
                      {story.title}
                    </h3>
                    <p className="text-xs text-[#020202]/50 mb-1">Starring {story.childName}</p>
                    <p className="text-xs text-[#020202]/40">{formatDate(story.createdAt)}</p>
                  </div>
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* ── My Photos ────────────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2
              className="text-2xl text-[#171E45]"
              style={{ fontFamily: "var(--font-rowdies)" }}
            >
              My Photos
            </h2>
            {photos.length > 0 && (
              <span className="text-xs text-[#020202]/40 bg-[#FBF1E3] rounded-full px-3 py-1 border border-[#FFD5C0]">
                {photos.length} saved
              </span>
            )}
          </div>

          {photos.length === 0 ? (
            <div className="rounded-3xl border-2 border-dashed border-[#FFD5C0] bg-[#FBF1E3]/50 py-12 text-center">
              <p className="text-4xl mb-3" aria-hidden="true">📷</p>
              <p className="text-sm font-semibold text-[#171E45]/70 mb-1">No photos yet</p>
              <p className="text-sm text-[#020202]/40">Upload a photo when creating a story to save it here</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {photos.map((photo) => (
                <div
                  key={photo.id}
                  className="group rounded-2xl overflow-hidden border border-[#FFD5C0]/60 bg-[#FBF1E3] aspect-square
                             shadow-[0_2px_8px_rgba(23,30,69,0.06)]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.url}
                    alt={photo.filename}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
