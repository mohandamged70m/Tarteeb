"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Client } from "@/lib/types";
import { btnGhost, btnPrimary, EmptyState, PageHeader } from "@/components/ui";

export default function ClientsList() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");

  async function load(q?: string) {
    setLoading(true);
    const res = await fetch(`/api/clients${q ? `?search=${encodeURIComponent(q)}` : ""}`);
    if (res.ok) setClients((await res.json()).clients);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(search || undefined), search ? 300 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: name.trim(), contact: contact.trim() || null }),
    });
    if (res.ok) {
      setName("");
      setContact("");
      load(search || undefined);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <PageHeader title="Clients" sub="Lightweight records. Never auto-merged." />
      <form onSubmit={create} className="mb-4 flex flex-col gap-2 rounded-lg border border-ink-700 bg-ink-900 p-4 sm:flex-row">
        <input aria-label="New client name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (required)" maxLength={120} className="min-w-0 flex-1 rounded-md border border-ink-700 bg-ink-850 px-3 py-2 text-sm text-ink-100 placeholder:text-ink-500" />
        <input aria-label="Contact info" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Contact (optional)" maxLength={300} className="min-w-0 flex-1 rounded-md border border-ink-700 bg-ink-850 px-3 py-2 text-sm text-ink-100 placeholder:text-ink-500" />
        <button type="submit" disabled={!name.trim()} className={btnPrimary}>Add</button>
      </form>
      <input
        aria-label="Search clients"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search clients…"
        className="mb-4 w-full rounded-md border border-ink-700 bg-ink-850 px-3 py-2 text-sm text-ink-100 placeholder:text-ink-500"
      />
      {loading ? (
        <div className="skeleton h-16 w-full" aria-label="Loading clients" />
      ) : clients.length === 0 ? (
        <EmptyState title={search ? "No clients match" : "No clients yet"} hint={search ? "Try a different search." : "Add your first client above."} />
      ) : (
        <ul className="flex flex-col gap-2">
          {clients.map((c) => (
            <li key={c.id}>
              <Link href={`/clients/${c.id}`} className="flex items-center justify-between gap-3 rounded-lg border border-ink-700 bg-ink-900 px-4 py-3 hover:bg-ink-800">
                <span className="text-sm font-medium text-ink-100">{c.name}</span>
                <span className="truncate text-xs text-ink-500">{c.contact ?? ""}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
