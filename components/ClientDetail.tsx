"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Client, Order } from "@/lib/types";
import { btnGhost, btnPrimary, PageHeader, StatusBadge } from "@/components/ui";

export default function ClientDetail({ id }: { id: string }) {
  const [client, setClient] = useState<Client | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: "", contact: "", notes: "" });

  async function load() {
    const res = await fetch(`/api/clients/${id}`);
    if (!res.ok) {
      setError("Client not found.");
      return;
    }
    const j = await res.json();
    setClient(j.client);
    setOrders(j.orders);
    setForm({ name: j.client.name, contact: j.client.contact ?? "", notes: j.client.notes ?? "" });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`/api/clients/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: form.name, contact: form.contact || null, notes: form.notes || null }),
    });
    if (res.ok) {
      setEditing(false);
      load();
    }
  }

  if (error) return <div className="mx-auto max-w-3xl px-4 py-6"><p role="alert" className="text-sm text-ink-100">{error}</p></div>;
  if (!client) return <div className="mx-auto max-w-3xl px-4 py-6" aria-label="Loading client"><div className="skeleton h-8 w-1/3" /></div>;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <PageHeader
        title={client.name}
        sub={client.contact ?? "No contact info"}
        action={<button type="button" onClick={() => setEditing(!editing)} className={btnGhost}>{editing ? "Cancel" : "Edit"}</button>}
      />
      {editing ? (
        <form onSubmit={save} className="mb-4 flex flex-col gap-3 rounded-lg border border-ink-700 bg-ink-900 p-4">
          <label className="flex flex-col gap-1 text-sm">Name
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="rounded-md border border-ink-700 bg-ink-850 px-3 py-2 text-sm text-ink-100" />
          </label>
          <label className="flex flex-col gap-1 text-sm">Contact (optional)
            <input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} className="rounded-md border border-ink-700 bg-ink-850 px-3 py-2 text-sm text-ink-100" />
          </label>
          <label className="flex flex-col gap-1 text-sm">Notes
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} className="rounded-md border border-ink-700 bg-ink-850 px-3 py-2 text-sm text-ink-100" />
          </label>
          <div><button type="submit" className={btnPrimary}>Save</button></div>
        </form>
      ) : client.notes ? (
        <p dir="auto" className="mb-4 whitespace-pre-wrap rounded-lg border border-ink-700 bg-ink-900 p-4 text-sm text-ink-300">{client.notes}</p>
      ) : null}
      <h2 className="mb-2 text-sm font-semibold text-ink-100">Related orders ({orders.length})</h2>
      {orders.length === 0 ? (
        <p className="text-sm text-ink-500">No orders for this client yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {orders.map((o) => (
            <li key={o.id}>
              <Link href={`/orders/${o.id}`} className="flex items-center justify-between gap-3 rounded-lg border border-ink-700 bg-ink-900 px-4 py-3 hover:bg-ink-800">
                <span className="truncate text-sm font-medium text-ink-100">{o.title}</span>
                <StatusBadge status={o.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
