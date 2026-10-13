"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import Logo from "./Logo";

const NAV = [
  { href: "/", label: "Home", icon: "⌂" },
  { href: "/orders", label: "Orders", icon: "▤" },
  { href: "/clients", label: "Clients", icon: "⛉" },
  { href: "/settings", label: "Settings", icon: "⚙" },
];

async function signOut(router: ReturnType<typeof useRouter>) {
  const res = await fetch("/api/auth/signout", { method: "POST" });
  if (!res.ok) throw new Error("Could not sign out. Please retry.");
  window.localStorage.removeItem("tarteeb:lastConv");
  router.push("/login");
  router.refresh();
}

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  async function handleSignOut() {
    setSigningOut(true);
    setSignOutError(null);
    try { await signOut(router); }
    catch { setSignOutError("Could not sign out. Please retry."); }
    finally { setSigningOut(false); }
  }
  const bare = pathname === "/login" || pathname === "/signup";

  if (bare) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-12">
        {children}
      </main>
    );
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar (desktop) */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-ink-700 bg-ink-900 md:flex">
        <div className="border-b border-ink-700 px-5 py-4">
          <Link href="/" aria-label="Tarteeb home" className="inline-block">
            <Logo height={26} />
          </Link>
        </div>
        <nav aria-label="Primary" className="flex flex-1 flex-col gap-1 p-3">
          {NAV.map((n) => {
            const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-md border-l-2 px-3 py-2 text-sm ${
                  active
                    ? "border-ink-100 bg-ink-800 font-semibold text-ink-100"
                    : "border-transparent text-ink-500 hover:bg-ink-800 hover:text-ink-300"
                }`}
              >
                <span aria-hidden="true" className="w-5 text-center">{n.icon}</span>
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-ink-700 p-3">
          <button
            type="button"
            disabled={signingOut}
            onClick={handleSignOut}
            className="w-full rounded-md px-3 py-2 text-left text-sm text-ink-500 hover:bg-ink-800 hover:text-ink-300 disabled:opacity-50"
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </aside>

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-ink-700 bg-ink-900 px-4 py-3 md:hidden">
          <Link href="/" aria-label="Tarteeb home" className="inline-block">
            <Logo height={22} />
          </Link>
          <button type="button" onClick={handleSignOut} disabled={signingOut} className="min-h-11 px-3 text-sm text-ink-300 disabled:opacity-50">
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </header>
        <main className="min-w-0 flex-1 pb-24 md:pb-10">
          {signOutError && <p role="alert" className="px-4 py-3 text-sm text-ink-100">{signOutError}</p>}
          {children}
        </main>
        {/* Bottom nav (mobile) */}
        <nav
          aria-label="Primary"
          className="fixed inset-x-0 bottom-0 grid grid-cols-4 border-t border-ink-700 bg-ink-900 md:hidden"
        >
          {NAV.map((n) => {
            const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 py-2.5 text-xs ${
                  active ? "font-semibold text-ink-100" : "text-ink-500"
                }`}
              >
                <span aria-hidden="true" className="text-base leading-none">{n.icon}</span>
                {n.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
