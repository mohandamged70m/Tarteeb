"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Logo from "@/components/Logo";
import { btnPrimary, Field, inputCls } from "@/components/ui";

export function AuthForm({ mode, initialError }: { mode: "signin" | "signup"; initialError?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
    const res = await fetch(mode === "signin" ? "/api/auth/signin" : "/api/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        ...(mode === "signup"
          ? {
              displayName,
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            }
          : {}),
      }),
    });
    const j = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) {
      setError(j?.error?.message ?? "Authentication failed.");
      return;
    }
    if (j?.requiresEmailConfirmation) {
      setNotice("Check your inbox. Open the confirmation link to finish creating your account, then sign in.");
      return;
    }
    router.push("/");
    router.refresh();
    } catch {
      setError("Could not connect. Please try again.");
    } finally { setBusy(false); }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Logo height={30} />
        <h1 className="mt-3 text-2xl font-semibold text-ink-100">
          {mode === "signin" ? "Welcome back" : "Create your account"}
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          {mode === "signin" ? "Sign in to manage your orders." : "One account, your clients, orders, and tasks."}
        </p>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-4">
        {mode === "signup" && (
          <Field label="Display name">
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required maxLength={120} autoComplete="name" className={inputCls} />
          </Field>
        )}
        <Field label="Email">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" className={inputCls} />
        </Field>
        <Field label="Password" hint={mode === "signup" ? "Minimum 8 characters." : undefined}>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={mode === "signup" ? 8 : 1} maxLength={200} autoComplete={mode === "signin" ? "current-password" : "new-password"} className={inputCls} />
        </Field>
        {notice && <p role="status" className="rounded-md border border-ink-700 p-3 text-sm text-ink-100">{notice}</p>}
        {error && <p role="alert" className="text-sm text-ink-100">{error}</p>}
        <button type="submit" disabled={busy} className={btnPrimary}>
          {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Sign up"}
        </button>
      </form>
      <p className="text-sm text-ink-500">
        {mode === "signin" ? (
          <>No account? <Link href="/signup" className="text-ink-100 underline underline-offset-2">Sign up</Link></>
        ) : (
          <>Have an account? <Link href="/login" className="text-ink-100 underline underline-offset-2">Sign in</Link></>
        )}
      </p>
    </div>
  );
}
