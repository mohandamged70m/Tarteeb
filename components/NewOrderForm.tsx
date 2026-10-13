"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Client } from "@/lib/types";
import { btnPrimary, Field, inputCls, PageHeader } from "@/components/ui";

export default function NewOrderForm() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState("");
  const [newClient, setNewClient] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("");
  const [tasks, setTasks] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/clients").then((r) => (r.ok ? r.json() : null)).then((j) => {
      if (j) setClients(j.clients);
    });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
    let cid: string | null = clientId || null;
    if (!cid && newClient.trim()) {
      const cr = await fetch("/api/clients", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: newClient.trim() }),
      });
      if (!cr.ok) { setError("Could not create the client. Please retry."); return; }
      cid = (await cr.json()).client.id;
    }
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        clientId: cid,
        title,
        description: description || null,
        deadlineDate: deadline || null,
        budgetAmount: amount ? Number(amount) : null,
        budgetCurrency: currency || null,
        tasks: tasks.split("\n").map((s) => s.trim()).filter(Boolean).map((t) => ({ title: t })),
      }),
    });
    const j = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) {
      setError(j?.error?.message ?? "Could not create the order.");
      return;
    }
    router.push(`/orders/${j.order.id}`);
    } catch { setError("Could not connect. Please try again."); }
    finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <PageHeader title="New order" sub="Manual creation — no AI needed." />
      <form onSubmit={submit} className="flex flex-col gap-4 rounded-lg border border-ink-700 bg-ink-900 p-4">
        <Field label="Title (required)">
          <input value={title} onChange={(e) => setTitle(e.target.value)} required minLength={3} maxLength={140} className={inputCls} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Existing client">
            <select value={clientId} onChange={(e) => setClientId(e.target.value)} className={inputCls}>
              <option value="">None</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Or new client name">
            <input value={newClient} onChange={(e) => setNewClient(e.target.value)} maxLength={120} className={inputCls} />
          </Field>
        </div>
        <Field label="Description">
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={inputCls} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Deadline (optional)">
            <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Budget (optional)">
            <span className="flex gap-1">
              <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="Amount" className={`${inputCls} tnum`} />
              <input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} placeholder="EGP" className={`${inputCls} w-20`} />
            </span>
          </Field>
        </div>
        <Field label="Tasks (one per line, optional)">
          <textarea value={tasks} onChange={(e) => setTasks(e.target.value)} rows={3} className={inputCls} />
        </Field>
        {error && <p role="alert" className="text-sm text-ink-100">{error}</p>}
        <div>
          <button type="submit" disabled={busy || title.trim().length < 3} className={btnPrimary}>
            {busy ? "Creating…" : "Create order"}
          </button>
        </div>
      </form>
    </div>
  );
}
