"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ActivityEntry, Client, Order, OrderTask } from "@/lib/types";
import { ORDER_TRANSITIONS, taskProgress, isOverdue } from "@/lib/types";
import { todayInTimezone } from "@/lib/dates";
import { formatMoney } from "@/lib/currency";
import { btnGhost, btnPrimary, PageHeader, StatusBadge } from "@/components/ui";

export default function OrderDetail({ id, timezone }: { id: string; timezone: string }) {
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [tasks, setTasks] = useState<OrderTask[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [client, setClient] = useState<Client | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", deadlineDate: "", budgetAmount: "", budgetCurrency: "" });
  const [newTask, setNewTask] = useState("");

  async function load() {
    const res = await fetch(`/api/orders/${id}`);
    if (res.status === 404) {
      setError("Order not found.");
      return;
    }
    if (!res.ok) {
      setError("Could not load this order.");
      return;
    }
    const j = await res.json();
    setOrder(j.order);
    setTasks(j.tasks);
    setActivity(j.activity);
    setClient(j.client);
    setForm({
      title: j.order.title,
      description: j.order.description ?? "",
      deadlineDate: j.order.deadlineDate ?? "",
      budgetAmount: j.order.budgetAmount?.toString() ?? "",
      budgetCurrency: j.order.budgetCurrency ?? "",
    });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function patch(body: Record<string, unknown>) {
    const res = await fetch(`/api/orders/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await res.json().catch(() => null);
    if (!res.ok) {
      setError(j?.error?.message ?? "Update failed.");
      return;
    }
    setEditing(false);
    await load();
  }

  async function cycleTask(t: OrderTask) {
    const next = t.status === "todo" ? "in_progress" : t.status === "in_progress" ? "done" : "todo";
    await fetch(`/api/orders/${id}/tasks/${t.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    await load();
  }

  async function addTask() {
    if (!newTask.trim()) return;
    await fetch(`/api/orders/${id}/tasks`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: newTask.trim() }),
    });
    setNewTask("");
    await load();
  }

  async function removeTask(taskId: string) {
    await fetch(`/api/orders/${id}/tasks/${taskId}`, { method: "DELETE" });
    await load();
  }

  if (error && !order) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6">
        <p role="alert" className="text-sm text-ink-100">{error}</p>
      </div>
    );
  }
  if (!order) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6" aria-label="Loading order">
        <div className="skeleton h-8 w-1/2" />
        <div className="skeleton mt-3 h-40 w-full" />
      </div>
    );
  }

  const prog = taskProgress(tasks);
  const overdue = isOverdue(order, todayInTimezone(timezone));
  const nextStatuses = ORDER_TRANSITIONS[order.status];

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <PageHeader
        title={order.title}
        sub={`${client?.name ?? "No client"}${order.deadlineDate ? ` · due ${order.deadlineDate}` : ""}${overdue ? " · OVERDUE" : ""}`}
        action={<StatusBadge status={order.status} />}
      />
      {error && <p role="alert" className="mb-3 text-sm text-ink-100">{error}</p>}

      <div className="mb-4 flex flex-wrap gap-2">
        <span className="text-xs text-ink-500">Move to:</span>
        {nextStatuses.length === 0 ? (
          <span className="text-xs text-ink-500">terminal state — no further transitions</span>
        ) : (
          nextStatuses.map((st) => (
            <button key={st} type="button" onClick={() => patch({ status: st })} className={btnGhost}>
              {st.replace("_", " ")}
            </button>
          ))
        )}
        <span className="flex-1" />
        <button type="button" onClick={() => setEditing(!editing)} className={btnGhost}>
          {editing ? "Cancel editing" : "Edit"}
        </button>
      </div>

      {editing ? (
        <form
          className="mb-4 flex flex-col gap-3 rounded-lg border border-ink-700 bg-ink-900 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            patch({
              title: form.title,
              description: form.description || null,
              deadlineDate: form.deadlineDate || null,
              budgetAmount: form.budgetAmount ? Number(form.budgetAmount) : null,
              budgetCurrency: form.budgetCurrency || null,
            });
          }}
        >
          <label className="flex flex-col gap-1 text-sm">Title
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="rounded-md border border-ink-700 bg-ink-850 px-3 py-2 text-sm text-ink-100" />
          </label>
          <label className="flex flex-col gap-1 text-sm">Description
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="rounded-md border border-ink-700 bg-ink-850 px-3 py-2 text-sm text-ink-100" />
          </label>
          <div className="flex gap-2">
            <label className="flex flex-1 flex-col gap-1 text-sm">Deadline
              <input type="date" value={form.deadlineDate} onChange={(e) => setForm({ ...form, deadlineDate: e.target.value })} className="rounded-md border border-ink-700 bg-ink-850 px-3 py-2 text-sm text-ink-100" />
            </label>
            <label className="flex flex-1 flex-col gap-1 text-sm">Budget
              <span className="flex gap-1">
                <input value={form.budgetAmount} onChange={(e) => setForm({ ...form, budgetAmount: e.target.value })} inputMode="decimal" className="tnum min-w-0 flex-1 rounded-md border border-ink-700 bg-ink-850 px-3 py-2 text-sm text-ink-100" />
                <input value={form.budgetCurrency} onChange={(e) => setForm({ ...form, budgetCurrency: e.target.value.toUpperCase() })} maxLength={3} placeholder="EGP" className="w-20 rounded-md border border-ink-700 bg-ink-850 px-2 py-2 text-sm text-ink-100" />
              </span>
            </label>
          </div>
          <div><button type="submit" className={btnPrimary}>Save</button></div>
        </form>
      ) : (
        <div className="mb-4 rounded-lg border border-ink-700 bg-ink-900 p-4 text-sm">
          {order.description && <p dir="auto" className="whitespace-pre-wrap text-ink-300">{order.description}</p>}
          <dl className="tnum mt-3 grid gap-2 sm:grid-cols-2">
            <div><dt className="text-xs text-ink-500">Budget</dt><dd className="text-ink-100">{order.budgetAmount != null && order.budgetCurrency ? formatMoney(order.budgetAmount, order.budgetCurrency) : "Unknown"}</dd></div>
            <div><dt className="text-xs text-ink-500">Deadline</dt><dd className="text-ink-100">{order.deadlineDate ?? "None"}{order.deadlineText ? ` (${order.deadlineText})` : ""}</dd></div>
          </dl>
          {order.deliverables.length > 0 && (
            <div className="mt-3"><p className="text-xs text-ink-500">Deliverables</p>
              <ul className="list-disc pl-5 text-ink-300">{order.deliverables.map((d) => <li key={d} dir="auto">{d}</li>)}</ul>
            </div>
          )}
          {order.requirements.length > 0 && (
            <div className="mt-3"><p className="text-xs text-ink-500">Requirements & scope</p>
              <ul className="list-disc pl-5 text-ink-300">{order.requirements.map((d) => <li key={d} dir="auto">{d}</li>)}</ul>
            </div>
          )}
        </div>
      )}

      <section aria-label="Tasks" className="mb-4 rounded-lg border border-ink-700 bg-ink-900 p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink-100">Tasks</h2>
          <span className="tnum text-xs text-ink-500">{prog.done}/{prog.total} · {prog.pct}%</span>
        </div>
        <div className="mb-3 h-1.5 overflow-hidden rounded bg-ink-800" role="progressbar" aria-valuenow={prog.pct} aria-valuemin={0} aria-valuemax={100} aria-label="Task progress">
          <div className="h-full bg-ink-100" style={{ width: `${prog.pct}%` }} />
        </div>
        {tasks.length === 0 ? (
          <p className="text-sm text-ink-500">No tasks yet. Add the first one below.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {tasks.map((t) => (
              <li key={t.id} className="flex items-center gap-2 rounded-md border border-ink-700 bg-ink-850 px-3 py-2 text-sm">
                <button
                  type="button"
                  onClick={() => cycleTask(t)}
                  aria-label={`Task "${t.title}" is ${t.status}. Activate to advance.`}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <span aria-hidden="true" className="w-5 shrink-0 text-center text-ink-100">
                    {t.status === "done" ? "■" : t.status === "in_progress" ? "▸" : "○"}
                  </span>
                  <span className={`min-w-0 flex-1 truncate ${t.status === "done" ? "text-ink-500 line-through" : "text-ink-100"}`}>
                    {t.title}
                  </span>
                  <span className="shrink-0 text-xs text-ink-500">
                    {t.status.replace("_", " ")}{t.isClientRequirement ? " · required" : ""}
                  </span>
                </button>
                <button type="button" onClick={() => removeTask(t.id)} aria-label={`Remove task ${t.title}`} className="shrink-0 px-1 text-ink-500 hover:text-ink-100">✕</button>
              </li>
            ))}
          </ul>
        )}
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            addTask();
          }}
        >
          <input
            aria-label="New task title"
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            placeholder="Add a task…"
            className="min-w-0 flex-1 rounded-md border border-ink-700 bg-ink-850 px-3 py-2 text-sm text-ink-100 placeholder:text-ink-500"
          />
          <button type="submit" disabled={!newTask.trim()} className={btnGhost}>Add</button>
        </form>
      </section>

      <section aria-label="Activity" className="rounded-lg border border-ink-700 bg-ink-900 p-4">
        <h2 className="mb-2 text-sm font-semibold text-ink-100">Activity</h2>
        {activity.length === 0 ? (
          <p className="text-sm text-ink-500">No activity yet.</p>
        ) : (
          <ul className="flex flex-col gap-1.5 text-sm">
            {activity.map((a) => (
              <li key={a.id} className="tnum flex justify-between gap-3 text-ink-500">
                <span className="text-ink-300">{a.detail}</span>
                <span className="shrink-0 text-xs">{a.createdAt.slice(0, 10)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
