"use client";

import { useRouter } from "next/navigation";

export default function Header() {
  const router = useRouter();
  
  return (
    <header className="sticky top-0 z-50 bg-[#FCF7EE]/90 backdrop-blur-sm border-b border-[#FFD5C0]">
      <div className="mx-auto max-w-6xl px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl" aria-hidden="true">📖</span>
          <span
            className="text-xl font-normal text-[#171E45]"
            style={{ fontFamily: "var(--font-rowdies)" }}
          >
            Hero Storybook
          </span>
        </div>
        <button
          onClick={() => router.push("/create")}
          className="rounded-full border border-[#FC800A] px-5 py-2 text-sm font-medium text-[#FC800A]
                     hover:bg-[#FC800A] hover:text-white
                     focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FC800A]
                     active:scale-[0.97]
                     transition-all duration-200"
        >
          Create Your Story
        </button>
      </div>
    </header>
  );
}
