"use client";

import { useEffect, useState } from "react";
import { btnGhost, btnPrimary, Field, inputCls, PageHeader } from "@/components/ui";
import { CURRENCIES } from "@/lib/currency";

export default function SettingsForm() {
  const [profile, setProfile] = useState({ displayName: "", timezone: "", defaultCurrency: "EGP" });
  const [ai, setAi] = useState<{ provider: string; model: string; keyHint: string | null } | null>(null);
  const [allowedModels, setAllowedModels] = useState<string[]>([]);
  const [hasOperatorKey, setHasOperatorKey] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  async function load() {
    const [p, a] = await Promise.all([fetch("/api/settings"), fetch("/api/settings/ai")]);
    if (p.ok) {
      const j = await p.json();
      setProfile({ displayName: j.profile.displayName, timezone: j.profile.timezone, defaultCurrency: j.profile.defaultCurrency });
    }
    if (a.ok) {
      const j = await a.json();
      setAi(j.ai);
      setAllowedModels(j.allowedModels ?? []);
      setHasOperatorKey(Boolean(j.hasOperatorKey));
      if (j.ai) setModel(j.ai.model);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(profile),
    });
    const j = await res.json().catch(() => null);
    if (!res.ok) setErr(j?.error?.message ?? "Could not save settings.");
    else setMsg("Profile saved.");
  }

  async function saveAI(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    const res = await fetch("/api/settings/ai", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: model || undefined, apiKey: apiKey || undefined }),
    });
    const j = await res.json().catch(() => null);
    if (!res.ok) {
      setErr(j?.error?.message ?? "Could not save AI settings.");
      return;
    }
    setAi(j.ai);
    setApiKey("");
    setMsg("AI settings saved.");
  }

  async function removeKey() {
    setMsg(null);
    setErr(null);
    const res = await fetch("/api/settings/ai", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ apiKey: null }),
    });
    const j = await res.json().catch(() => null);
    if (!res.ok) setErr(j?.error?.message ?? "Could not remove key.");
    else {
      setAi(j.ai);
      setMsg("API key removed. Intake will use the offline assistant.");
    }
  }

  async function test() {
    setTesting(true);
    setMsg(null);
    setErr(null);
    const res = await fetch("/api/ai/test", { method: "POST" });
    const j = await res.json().catch(() => null);
    setTesting(false);
    if (!res.ok) setErr(j?.error?.message ?? "Connection test failed.");
    else setMsg(`Connection works (using ${j.which === "user" ? "your" : "operator"} key, model ${j.model}).`);
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <PageHeader title="Settings" sub="Profile, locale, and AI configuration." />
      {msg && <p role="status" className="mb-3 rounded-md border border-ink-700 bg-ink-900 px-4 py-2 text-sm text-ink-100">✓ {msg}</p>}
      {err && <p role="alert" className="mb-3 rounded-md border border-ink-700 bg-ink-900 px-4 py-2 text-sm text-ink-100">{err}</p>}

      <form onSubmit={saveProfile} className="mb-6 flex flex-col gap-4 rounded-lg border border-ink-700 bg-ink-900 p-4">
        <h2 className="text-sm font-semibold text-ink-100">Profile</h2>
        <Field label="Display name">
          <input value={profile.displayName} onChange={(e) => setProfile({ ...profile, displayName: e.target.value })} required className={inputCls} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Timezone" hint="IANA name, e.g. Africa/Cairo. Used for relative dates.">
            <input value={profile.timezone} onChange={(e) => setProfile({ ...profile, timezone: e.target.value })} placeholder="Africa/Cairo" className={inputCls} />
          </Field>
          <Field label="Default currency">
            <select value={profile.defaultCurrency} onChange={(e) => setProfile({ ...profile, defaultCurrency: e.target.value })} className={inputCls}>
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>{c.label}</option>
              ))}
            </select>
          </Field>
        </div>
        <div><button type="submit" className={btnPrimary}>Save profile</button></div>
      </form>

      <form onSubmit={saveAI} className="flex flex-col gap-4 rounded-lg border border-ink-700 bg-ink-900 p-4">
        <h2 className="text-sm font-semibold text-ink-100">AI provider</h2>
        <p className="text-sm text-ink-500">
          This app uses your own key by default (BYOK) — it is encrypted on the server and never shown again.
          {hasOperatorKey ? " An operator key is also configured as a fallback." : " No operator key is configured."}
          {" "}Without any key, intake uses the labelled offline assistant, and manual order management always works.
        </p>
        <Field label="Model" hint={`Allowed: ${(allowedModels.join(", ") || "—")}`}>
          <select value={model} onChange={(e) => setModel(e.target.value)} className={inputCls}>
            {allowedModels.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </Field>
        <Field label={ai?.keyHint ? `API key (stored: ${ai.keyHint})` : "API key"} hint="Paste to set or replace. Leave blank to keep the current key.">
          <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={ai?.keyHint ? "•••• — leave blank to keep" : "sk-…"} autoComplete="off" className={inputCls} />
        </Field>
        <div className="flex flex-wrap gap-2">
          <button type="submit" className={btnPrimary}>Save AI settings</button>
          <button type="button" onClick={test} disabled={testing} className={btnGhost}>
            {testing ? "Testing…" : "Test connection"}
          </button>
          {ai?.keyHint && (
            <button type="button" onClick={removeKey} className={btnGhost}>
              Remove key
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
