"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Client, Order } from "@/lib/types";
import { btnGhost, btnPrimary, EmptyState, PageHeader, StatusBadge } from "@/components/ui";
import { isOverdue } from "@/lib/types";
import { todayInTimezone } from "@/lib/dates";

type Row = Order & { clientName: string | null };

export default function OrdersList({ timezone }: { timezone: string }) {
  const [orders, setOrders] = useState<Row[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [clientId, setClientId] = useState("");
  const [sort, setSort] = useState<"created" | "due">("created");

  async function load() {
    setLoading(true);
    const q = new URLSearchParams();
    if (search) q.set("search", search);
    if (status !== "all") q.set("status", status);
    if (clientId) q.set("clientId", clientId);
    q.set("sort", sort);
    const res = await fetch(`/api/orders?${q}`);
    if (res.ok) setOrders((await res.json()).orders);
    setLoading(false);
  }

  useEffect(() => {
    fetch("/api/clients").then((r) => (r.ok ? r.json() : null)).then((j) => {
      if (j) setClients(j.clients);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status, clientId, sort]);

  const today = todayInTimezone(timezone);
  const filtering = search || status !== "all" || clientId;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <PageHeader
        title="Orders"
        sub="Search, filter, and track every order."
        action={
          <Link href="/orders/new" className={btnPrimary}>
            + New order
          </Link>
        }
      />
      <div className="mb-4 grid gap-2 sm:grid-cols-4">
        <input
          aria-label="Search orders"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search title or client…"
          className="rounded-md border border-ink-700 bg-ink-850 px-3 py-2 text-sm text-ink-100 placeholder:text-ink-500 sm:col-span-2"
        />
        <select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-md border border-ink-700 bg-ink-850 px-2 py-2 text-sm text-ink-300">
          {["all", "draft", "ready", "in_progress", "delivered", "completed", "cancelled"].map((s) => (
            <option key={s} value={s}>{s === "all" ? "All statuses" : s.replace("_", " ")}</option>
          ))}
        </select>
        <select aria-label="Filter by client" value={clientId} onChange={(e) => setClientId(e.target.value)} className="rounded-md border border-ink-700 bg-ink-850 px-2 py-2 text-sm text-ink-300">
          <option value="">All clients</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      <div className="mb-4 flex gap-2 text-sm">
        <span className="py-1 text-ink-500">Sort:</span>
        {(["created", "due"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSort(s)}
            aria-pressed={sort === s}
            className={`rounded-md px-3 py-1 ${sort === s ? "bg-ink-100 font-semibold text-black" : "border border-ink-700 text-ink-300"}`}
          >
            {s === "created" ? "Newest" : "Due date"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex flex-col gap-2" aria-label="Loading orders">
          <div className="skeleton h-16 w-full" />
          <div className="skeleton h-16 w-full" />
        </div>
      ) : orders.length === 0 ? (
        filtering ? (
          <EmptyState title="No orders match" hint="Try clearing the search or filters." action={<button type="button" onClick={() => { setSearch(""); setStatus("all"); setClientId(""); }} className={btnGhost}>Clear filters</button>} />
        ) : (
          <EmptyState
            title="No orders yet"
            hint="Paste a client message on Home, or create one manually."
            action={<Link href="/orders/new" className={btnPrimary}>Create manually</Link>}
          />
        )
      ) : (
        <ul className="flex flex-col gap-2">
          {orders.map((o) => (
            <li key={o.id}>
              <Link
                href={`/orders/${o.id}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-ink-700 bg-ink-900 px-4 py-3 hover:bg-ink-800"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-ink-100">{o.title}</span>
                  <span className="tnum mt-0.5 block text-xs text-ink-500">
                    {o.clientName ?? "No client"}{o.deadlineDate ? ` · due ${o.deadlineDate}` : ""}
                    {isOverdue(o, today) && " · OVERDUE"}
                  </span>
                </span>
                <StatusBadge status={o.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
