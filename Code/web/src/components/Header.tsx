"use client";

import { useRouter } from "next/navigation";
import { useSession, signIn, signOut } from "next-auth/react";
import { useState, useRef, useEffect } from "react";

const ADMIN_EMAILS = ["amitkarmakar1980@gmail.com"];

function UserMenu({ name, image, email }: { name?: string | null; image?: string | null; email?: string | null }) {
  const isAdmin = !!email && ADMIN_EMAILS.includes(email);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const initial = name?.[0]?.toUpperCase() ?? email?.[0]?.toUpperCase() ?? "?";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full pl-1 pr-3 py-1 border border-[#FFD5C0]
                   hover:border-[#FC800A]/50 hover:bg-[#FBF1E3]
                   focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FC800A]
                   transition-all duration-200"
        aria-label="User menu"
      >
        {image ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={image} alt={name ?? "User"} className="w-7 h-7 rounded-full object-cover" width={28} height={28} />
        ) : (
          <span className="w-7 h-7 rounded-full bg-[#FC800A] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
            {initial}
          </span>
        )}
        <span className="text-sm font-medium text-[#171E45] max-w-[100px] truncate hidden sm:block">
          {name ?? email}
        </span>
        <svg className={`w-3.5 h-3.5 text-[#020202]/40 transition-transform duration-200 ${open ? "rotate-180" : ""}`} viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-52 rounded-2xl bg-white border border-[#FFD5C0]/60
                     shadow-[0_8px_32px_rgba(23,30,69,0.12)] overflow-hidden z-50"
        >
          <div className="px-4 py-3 border-b border-[#FFD5C0]/50">
            <p className="text-xs font-semibold text-[#171E45] truncate">{name}</p>
            <p className="text-xs text-[#020202]/40 truncate mt-0.5">{email}</p>
          </div>
          <button
            type="button"
            onClick={() => { setOpen(false); router.push("/profile"); }}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[#171E45]
                       hover:bg-[#FCF7EE] transition-colors duration-150 text-left"
          >
            <svg className="w-4 h-4 text-[#FC800A]" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-7 9a7 7 0 1 1 14 0H3Z" clipRule="evenodd"/>
            </svg>
            My Profile
          </button>
          {isAdmin && (
            <button
              type="button"
              onClick={() => { setOpen(false); router.push("/admin"); }}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[#171E45]
                         hover:bg-[#FCF7EE] transition-colors duration-150 text-left"
            >
              <svg className="w-4 h-4 text-[#FC800A]" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M8.34 1.804A1 1 0 0 1 9.32 1h1.36a1 1 0 0 1 .98.804l.17.862a6.537 6.537 0 0 1 1.329.768l.847-.254a1 1 0 0 1 1.174.454l.68 1.177a1 1 0 0 1-.205 1.273l-.668.56a6.6 6.6 0 0 1 0 1.532l.668.56a1 1 0 0 1 .205 1.274l-.68 1.177a1 1 0 0 1-1.174.454l-.847-.254a6.537 6.537 0 0 1-1.329.768l-.17.862A1 1 0 0 1 10.68 13H9.32a1 1 0 0 1-.98-.804l-.17-.862a6.538 6.538 0 0 1-1.329-.768l-.847.254a1 1 0 0 1-1.174-.454l-.68-1.177a1 1 0 0 1 .205-1.273l.668-.56a6.6 6.6 0 0 1 0-1.532l-.668-.56a1 1 0 0 1-.205-1.274l.68-1.177a1 1 0 0 1 1.174-.454l.847.254A6.537 6.537 0 0 1 8.17 2.666l.17-.862ZM10 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z" clipRule="evenodd"/>
                <path d="M3 17a1 1 0 0 1 1-1h12a1 1 0 1 1 0 2H4a1 1 0 0 1-1-1Z"/>
              </svg>
              Admin
            </button>
          )}
          <button
            type="button"
            onClick={() => { setOpen(false); signOut({ callbackUrl: "/" }); }}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[#171E45]
                       hover:bg-[#FCF7EE] transition-colors duration-150 text-left border-t border-[#FFD5C0]/40"
          >
            <svg className="w-4 h-4 text-[#020202]/40" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M3 4.25A2.25 2.25 0 0 1 5.25 2h5.5A2.25 2.25 0 0 1 13 4.25v2a.75.75 0 0 1-1.5 0v-2a.75.75 0 0 0-.75-.75h-5.5a.75.75 0 0 0-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 0 0 .75-.75v-2a.75.75 0 0 1 1.5 0v2A2.25 2.25 0 0 1 10.75 18h-5.5A2.25 2.25 0 0 1 3 15.75V4.25Z" clipRule="evenodd"/>
              <path fillRule="evenodd" d="M6 10a.75.75 0 0 1 .75-.75h9.546l-1.048-1.02a.75.75 0 1 1 1.04-1.08l2.5 2.437a.75.75 0 0 1 0 1.083l-2.5 2.438a.75.75 0 0 1-1.04-1.08l1.048-1.02H6.75A.75.75 0 0 1 6 10Z" clipRule="evenodd"/>
            </svg>
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}

export default function Header() {
  const router = useRouter();
  const { data: session, status } = useSession();

  return (
    <header className="sticky top-0 z-50 bg-[#FCF7EE]/90 backdrop-blur-sm border-b border-[#FFD5C0]">
      <div className="mx-auto max-w-6xl px-5 py-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="flex items-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FC800A] rounded-lg"
        >
          <span className="text-2xl" aria-hidden="true">📖</span>
          <span
            className="text-xl font-normal text-[#171E45]"
            style={{ fontFamily: "var(--font-rowdies)" }}
          >
            Hero Storybook
          </span>
        </button>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/create")}
            className="rounded-full border border-[#FC800A] px-5 py-2 text-sm font-medium text-[#FC800A]
                       hover:bg-[#FC800A] hover:text-white
                       focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FC800A]
                       active:scale-[0.97]
                       transition-all duration-200 hidden sm:block"
          >
            Create Your Story
          </button>

          {status === "loading" ? (
            <div className="w-9 h-9 rounded-full bg-[#FFD5C0]/50 animate-pulse" />
          ) : session?.user ? (
            <UserMenu
              name={session.user.name}
              image={session.user.image}
              email={session.user.email}
            />
          ) : (
            <button
              type="button"
              onClick={() => signIn("google")}
              className="flex items-center gap-2 rounded-full bg-[#171E45] text-white px-4 py-2 text-sm font-medium
                         hover:bg-[#0f1430] active:scale-[0.97]
                         focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#171E45]
                         transition-all duration-200"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Sign In
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
