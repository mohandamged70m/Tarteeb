"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { ChatMessage, Client, Conversation, Proposal } from "@/lib/types";
import { btnGhost, ErrorState } from "./ui";

const EXAMPLES = [
  "Ahmed wants a landing page for his gym, 5 sections, delivery next Friday, budget 8000 EGP.",
  "أحمد عايز لاندنج بيج للجيم بتاعه تتسلم الجمعة الجاية.",
  "Client: Sara — logo + Instagram templates, needs it before end of month, budget undecided.",
];

const MAX_INPUT = 12000;

interface ThreadData {
  conversation: Conversation;
  messages: ChatMessage[];
  proposal: Proposal | null;
  orderId: string | null;
}

type SendState = "idle" | "sending" | "error";

function shortChip(text: string): string {
  return text.length > 64 ? `${text.slice(0, 64)}…` : text;
}

export default function Intake({ initialId }: { initialId: string | null }) {
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(initialId);
  const [thread, setThread] = useState<ThreadData | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sendState, setSendState] = useState<SendState>("idle");
  const [sendError, setSendError] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadConvs = useCallback(async () => {
    try {
    const res = await fetch("/api/conversations");
    if (res.ok) {
      const j = await res.json();
      setConvs(j.conversations);
    }
    } catch { setLoadError("Could not load conversation history. Retry shortly."); }
  }, []);

  const loadThread = useCallback(async (id: string) => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/conversations/${id}`);
      if (!res.ok) throw new Error("Could not load this conversation.");
      const j = await res.json();
      setThread(j);
      window.localStorage.setItem("tarteeb:lastConv", id);
    } catch (e) {
      setLoadError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConvs();
    fetch("/api/clients").then((r) => (r.ok ? r.json() : null)).then((j) => {
      if (j) setClients(j.clients);
    }).catch(() => setLoadError("Could not load clients. Retry shortly."));
    const saved = initialId ?? window.localStorage.getItem("tarteeb:lastConv");
    if (saved) {
      setCurrentId(saved);
      loadThread(saved);
    }
  }, [initialId, loadConvs, loadThread]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "nearest" });
  }, [thread?.messages.length]);

  async function startNew() {
    setLoadError(null);
    try {
    const res = await fetch("/api/conversations", { method: "POST" });
    if (!res.ok) throw new Error("Could not start a new intake. Retry shortly.");
    const j = await res.json();
    setCurrentId(j.conversation.id);
    setThread({ conversation: j.conversation, messages: [], proposal: null, orderId: null });
    setDraft("");
    await loadConvs();
    } catch { setLoadError("Could not start a new intake. Retry shortly."); }
  }

  async function send() {
    if (!draft.trim() || sendState === "sending") return;
    setSendState("sending");
    const content = draft;
    setSendError(null);
    try {
    let id = currentId;
    if (!id) {
      const res = await fetch("/api/conversations", { method: "POST" });
      if (!res.ok) {
        setSendError("Could not start a conversation. Retry.");
        setSendState("error");
        return;
      }
      const j = await res.json();
      id = j.conversation.id;
      setCurrentId(id);
      await loadConvs();
    }
    setDraft("");
      const res = await fetch("/api/intake/message", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          conversationId: id,
          content,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        setDraft(content); // preserve input
        setSendError(j?.error?.message ?? "The assistant failed. Your message is preserved — retry.");
        setSendState("error");
        return;
      }
      setSendState("idle");
      await loadThread(id!);
    } catch {
      setDraft(content);
      setSendError("Network error. Your message is preserved — retry.");
      setSendState("error");
    }
  }

  const confirmed = thread?.conversation.status === "confirmed" || Boolean(thread?.orderId);
  const proposal = thread?.proposal && thread.proposal.status !== "superseded" ? thread.proposal : null;
  const hasMessages = (thread?.messages.length ?? 0) > 0;

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col px-4">
      {/* Minimal thread toolbar — history + new chat, no dashboard chrome */}
      <div className="flex items-center justify-end gap-2 py-3">
        {convs.length > 0 && (
          <select
            aria-label="Past conversations"
            value={currentId ?? ""}
            onChange={(e) => {
              setCurrentId(e.target.value);
              loadThread(e.target.value);
            }}
            className="max-w-40 rounded-md border border-ink-700 bg-ink-850 px-2 py-2 text-sm text-ink-300"
          >
            <option value="" disabled>History…</option>
            {convs.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        )}
        {(thread || convs.length > 0) && (
          <button type="button" onClick={startNew} className={btnGhost}>
            + New
          </button>
        )}
      </div>

      {loadError && <ErrorState message={loadError} onRetry={() => currentId && loadThread(currentId)} />}

      {!thread && !loading && (
        <div className="flex min-h-[calc(100dvh-240px)] flex-col items-center justify-center py-10 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-ink-100">
            What did your client ask for?
          </h1>
          <div className="mt-6 w-full">
            <Composer draft={draft} onDraft={setDraft} onSend={send} sendState={sendState} />
          </div>
          <div className="mt-4 flex w-full flex-wrap items-center justify-center gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                title={ex}
                onClick={() => setDraft(ex)}
                className="max-w-full truncate rounded-full border border-ink-700 bg-transparent px-3 py-1.5 text-xs text-ink-500 hover:border-ink-500 hover:text-ink-300"
              >
                <span dir="auto">{shortChip(ex)}</span>
              </button>
            ))}
          </div>
          {sendError && (
            <div role="alert" className="mt-4 w-full rounded-2xl border border-ink-700 bg-ink-900 px-4 py-3 text-left text-sm">
              <p className="font-medium text-ink-100">The assistant hit a problem</p>
              <p className="mt-1 text-ink-500">{sendError}</p>
              <button type="button" onClick={send} className={`${btnGhost} mt-2`}>
                Retry
              </button>
            </div>
          )}
        </div>
      )}

      {loading && (
        <div className="flex flex-col gap-3 py-6" aria-label="Loading conversation">
          <div className="skeleton h-12 w-3/4" />
          <div className="skeleton h-24 w-full" />
          <div className="skeleton h-12 w-2/3" />
        </div>
      )}

      {thread && (
        <div aria-live="polite" className="flex flex-col gap-6 py-2 pb-8">
          {thread.messages.map((m) =>
            m.role === "user" ? (
              <div key={m.id} className="flex justify-end">
                <div
                  dir="auto"
                  className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-ink-800 px-4 py-2.5 text-[15px] leading-7 text-ink-100"
                >
                  <span className="sr-only">You: </span>
                  {m.content}
                </div>
              </div>
            ) : (
              <div key={m.id} className="flex justify-start">
                <div
                  dir="auto"
                  className="w-full whitespace-pre-wrap text-[15px] leading-7 text-ink-300"
                >
                  <span className="sr-only">Assistant: </span>
                  {m.content}
                </div>
              </div>
            ),
          )}
          {sendState === "sending" && (
            <div className="flex items-center gap-2 text-sm text-ink-500" role="status">
              <span aria-hidden="true" className="inline-block h-2 w-2 animate-pulse rounded-full bg-ink-500" />
              Working — structuring your request…
            </div>
          )}
          <div ref={bottomRef} className="scroll-mb-44" />
        </div>
      )}

      {thread && sendError && (
        <div role="alert" className="mb-4 rounded-2xl border border-ink-700 bg-ink-900 px-4 py-3 text-sm">
          <p className="font-medium text-ink-100">The assistant hit a problem</p>
          <p className="mt-1 text-ink-500">{sendError}</p>
          <button type="button" onClick={send} className={`${btnGhost} mt-2`}>
            Retry
          </button>
        </div>
      )}

      {thread && confirmed && thread?.orderId && (
        <div className="mb-4 rounded-2xl border border-ink-700 bg-ink-900 px-4 py-3 text-sm">
          <p className="text-ink-300">
            ✓ Order created.{" "}
            <Link href={`/orders/${thread.orderId}`} className="font-semibold text-ink-100 underline underline-offset-2">
              Open the order
            </Link>
            . Further messages here won&apos;t change it — start a new intake for new work.
          </p>
        </div>
      )}

      {thread && proposal && !confirmed && (
        <div className="mb-6">
          <ClarifyAndPreview
            key={proposal.id}
            proposal={proposal}
            conversationId={thread!.conversation.id}
            clients={clients}
            onRefresh={async () => {
              await loadThread(thread!.conversation.id);
              const r = await fetch("/api/clients");
              if (r.ok) setClients((await r.json()).clients);
            }}
          />
        </div>
      )}

      {/* Docked composer once the conversation exists */}
      {thread && (
        <div className="sticky bottom-[76px] z-10 bg-ink-950/95 pb-3 pt-2 backdrop-blur md:bottom-4">
          <Composer draft={draft} onDraft={setDraft} onSend={send} sendState={sendState} />
          {!hasMessages && (
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  title={ex}
                  onClick={() => setDraft(ex)}
                  className="max-w-full truncate rounded-full border border-ink-700 bg-transparent px-3 py-1.5 text-xs text-ink-500 hover:border-ink-500 hover:text-ink-300"
                >
                  <span dir="auto">{shortChip(ex)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Composer({
  draft,
  onDraft,
  onSend,
  sendState,
}: {
  draft: string;
  onDraft: (v: string) => void;
  onSend: () => void;
  sendState: SendState;
}) {
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const composingRef = useRef(false);
  const sending = sendState === "sending";
  const canSend = draft.trim().length > 0 && !sending;

  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [draft]);

  return (
    <div className="rounded-3xl border border-ink-700 bg-ink-850 p-3 shadow-[0_8px_30px_rgba(0,0,0,0.35)] transition-colors focus-within:border-ink-500 focus-within:ring-2 focus-within:ring-ink-100/15">
      <label htmlFor="composer" className="sr-only">Paste a client message</label>
      <textarea
        id="composer"
        ref={areaRef}
        value={draft}
        onChange={(e) => onDraft(e.target.value)}
        onCompositionStart={() => { composingRef.current = true; }}
        onCompositionEnd={() => { composingRef.current = false; }}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing || composingRef.current || e.keyCode === 229) return;
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSend();
          }
        }}
        rows={3}
        maxLength={MAX_INPUT}
        placeholder="Paste your client’s message…"
        disabled={sending}
        className="max-h-[200px] w-full resize-none bg-transparent px-2 py-1 text-base leading-6 text-ink-100 placeholder:text-ink-500 focus:outline-none disabled:opacity-60"
      />
      <div className="mt-1 flex items-center justify-between gap-2 px-1">
        <span className="tnum text-[11px] text-ink-500/70" aria-label={`${draft.length} of ${MAX_INPUT} characters`}>
          {draft.length.toLocaleString()} / 12,000
        </span>
        <button
          type="button"
          onClick={onSend}
          disabled={!canSend}
          aria-label={sending ? "Working" : "Send message"}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink-100 text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:bg-ink-700 disabled:text-ink-500"
        >
          {sending ? (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="animate-spin">
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeOpacity="0.3" />
              <path d="M14 8a6 6 0 0 0-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M8 13V3M3.5 7.5 8 3l4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}

function ClarifyAndPreview({
  proposal,
  conversationId,
  clients,
  onRefresh,
}: {
  proposal: Proposal;
  conversationId: string;
  clients: Client[];
  onRefresh: () => Promise<void>;
}) {
  const p = proposal.payload;
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Editable preview state, seeded from proposal.
  const [title, setTitle] = useState(p.title);
  const [deliverables, setDeliverables] = useState(p.deliverables.join("\n"));
  const [requirements, setRequirements] = useState(p.requirements.map((r) => r.text).join("\n"));
  const [deadline, setDeadline] = useState(p.deadline.dateISO ?? "");
  const [amount, setAmount] = useState(p.budget.amount?.toString() ?? "");
  const [currency, setCurrency] = useState(p.budget.currency ?? "");
  const [tasks, setTasks] = useState(p.tasks.map((t) => t.title).join("\n"));
  const [clientId, setClientId] = useState("");
  const [newClient, setNewClient] = useState(p.clientName ?? "");
  const [confirmState, setConfirmState] = useState<"idle" | "pending" | "done" | "error">("idle");
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const idemKey = useRef(crypto.randomUUID());

  async function sendAnswers() {
    const filled = p.missingEssential
      .filter((q) => answers[q.field]?.trim())
      .map((q) => ({ questionId: q.field, field: q.field, answer: answers[q.field].trim() }));
    if (filled.length === 0) return;
    setBusy(true);
    setError(null);
    try {
    const res = await fetch("/api/intake/answer", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ conversationId, answers: filled }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => null);
      setError(j?.error?.message ?? "Could not update the proposal. Retry.");
      return;
    }
    await onRefresh();
    } catch { setError("Could not connect. Your answers are preserved — retry."); }
    finally { setBusy(false); }
  }

  async function confirm() {
    if (confirmState === "pending" || confirmState === "done") return;
    setConfirmState("pending");
    setConfirmError(null);
    try {
    const res = await fetch("/api/intake/confirm", {
      method: "POST",
      headers: { "content-type": "application/json", "Idempotency-Key": idemKey.current },
      body: JSON.stringify({
        conversationId,
        proposalId: proposal.id,
        idempotencyKey: idemKey.current,
        clientId: clientId || null,
        newClientName: !clientId && newClient.trim() ? newClient.trim() : null,
        title,
        description: p.summary,
        deliverables: deliverables.split("\n").map((s) => s.trim()).filter(Boolean),
        requirements: requirements.split("\n").map((s) => s.trim()).filter(Boolean),
        deadlineDate: deadline || null,
        deadlineText: p.deadline.textOriginal,
        budgetAmount: amount ? Number(amount) : null,
        budgetCurrency: currency || null,
        tasks: tasks.split("\n").map((s) => s.trim()).filter(Boolean).map((t) => ({ title: t, isClientRequirement: p.tasks.find((original) => original.title.trim() === t)?.isClientRequirement ?? false })),
      }),
    });
    const j = await res.json().catch(() => null);
    if (!res.ok) {
      setConfirmState("error");
      setConfirmError(j?.error?.message ?? "Could not create the order. Retry — it is safe (no duplicates).");
      return;
    }
    setConfirmState("done");
    setOrderId(j.order.id);
    await onRefresh();
    } catch {
      setConfirmState("error");
      setConfirmError("Could not connect. Retry this confirmation — the same key prevents duplicate orders.");
    }
  }

  return (
    <details open aria-label="Order proposal" className="rounded-2xl border border-ink-700 bg-ink-900">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-ink-100 marker:hidden [&::-webkit-details-marker]:hidden">
        Order preview <span className="ml-1 text-xs font-normal text-ink-500">({proposal.status} · editable — expand to review)</span>
      </summary>
      <div className="flex flex-col gap-3 border-t border-ink-700 p-4">
      {p.missingEssential.length > 0 && (
        <div className="flex flex-col gap-2 rounded-xl border border-ink-700 bg-ink-850 p-3">
          <p className="text-sm font-medium text-ink-100">A few questions to finish the draft</p>
          {p.missingEssential.map((q) => (
            <div key={q.field} className="flex flex-col gap-1">
              <label htmlFor={`q-${q.field}`} className="text-sm text-ink-300" dir="auto">{q.question}</label>
              <input
                id={`q-${q.field}`}
                value={answers[q.field] ?? ""}
                onChange={(e) => setAnswers({ ...answers, [q.field]: e.target.value })}
                placeholder="Type your answer, or leave blank to decide later"
                className="rounded-md border border-ink-700 bg-ink-900 px-3 py-2 text-sm text-ink-100 placeholder:text-ink-500"
              />
            </div>
          ))}
          {error && <p role="alert" className="text-sm text-ink-100">{error}</p>}
          <div>
            <button type="button" onClick={sendAnswers} disabled={busy} className={btnGhost}>
              {busy ? "Updating…" : "Send answers"}
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-ink-300">Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="rounded-md border border-ink-700 bg-ink-850 px-3 py-2 text-sm text-ink-100" />
        </label>
        <div className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-ink-300">Client</span>
          <div className="flex gap-2">
            <select
              aria-label="Existing client"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="min-w-0 flex-1 rounded-md border border-ink-700 bg-ink-850 px-2 py-2 text-sm text-ink-300"
            >
              <option value="">Select existing…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <input
              aria-label="New client name"
              value={newClient}
              onChange={(e) => { setNewClient(e.target.value); }}
              placeholder={p.clientName ? `New: ${p.clientName}` : "Or new name…"}
              className="min-w-0 flex-1 rounded-md border border-ink-700 bg-ink-850 px-3 py-2 text-sm text-ink-100 placeholder:text-ink-500"
            />
          </div>
          {p.clientName && !clientId && (
            <span className="text-xs text-ink-500">Suggested: “{p.clientName}” — confirm by keeping the name, or pick an existing record. Never auto-merged.</span>
          )}
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-ink-300">Deliverables (one per line)</span>
          <textarea value={deliverables} onChange={(e) => setDeliverables(e.target.value)} rows={3} className="rounded-md border border-ink-700 bg-ink-850 px-3 py-2 text-sm text-ink-100" />
        </label>
        <div className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-ink-300">Requirements (one per line)</span>
          <textarea
            value={requirements}
            onChange={(e) => setRequirements(e.target.value)}
            rows={3}
            aria-describedby="req-source-note"
            className="rounded-md border border-ink-700 bg-ink-850 px-3 py-2 text-sm text-ink-100"
          />
          <span id="req-source-note" className="text-xs text-ink-500">
            {p.requirements.filter((r) => r.source === "explicit").length} from client ·{" "}
            {p.requirements.filter((r) => r.source === "suggested").length} suggested
          </span>
        </div>
        <div className="flex gap-2">
          <label className="flex flex-1 flex-col gap-1 text-sm">
            <span className="font-medium text-ink-300">Deadline</span>
            <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="rounded-md border border-ink-700 bg-ink-850 px-3 py-2 text-sm text-ink-100" />
          </label>
          <label className="flex flex-1 flex-col gap-1 text-sm">
            <span className="font-medium text-ink-300">Budget</span>
            <div className="flex gap-1">
              <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="Unknown" className="tnum min-w-0 flex-1 rounded-md border border-ink-700 bg-ink-850 px-3 py-2 text-sm text-ink-100 placeholder:text-ink-500" />
              <input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} placeholder="EGP" maxLength={3} className="w-20 rounded-md border border-ink-700 bg-ink-850 px-2 py-2 text-sm text-ink-100 placeholder:text-ink-500" />
            </div>
          </label>
        </div>
        <div className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-ink-300">Tasks (one per line)</span>
          <textarea
            value={tasks}
            onChange={(e) => setTasks(e.target.value)}
            rows={3}
            aria-describedby="task-source-note"
            className="rounded-md border border-ink-700 bg-ink-850 px-3 py-2 text-sm text-ink-100"
          />
          <span id="task-source-note" className="text-xs text-ink-500">
            {p.tasks.filter((t) => t.isClientRequirement).length} client-required ·{" "}
            {p.tasks.filter((t) => !t.isClientRequirement).length} suggested — new lines default to suggested
          </span>
        </div>
      </div>

      {p.deadline.interpretation && (
        <p className="text-xs text-ink-500">Deadline reading: {p.deadline.interpretation}{p.deadline.ambiguous ? " — please confirm" : ""}</p>
      )}
      {p.budget.unknown && (
        <p className="text-xs text-ink-500">Budget unknown — fine to confirm as Draft and decide later.</p>
      )}

      {confirmError && <p role="alert" className="text-sm text-ink-100">{confirmError}</p>}
      {confirmState === "done" && orderId ? (
        <p className="text-sm text-ink-100">
          ✓ Order created. <Link href={`/orders/${orderId}`} className="font-semibold underline underline-offset-2">Open the order</Link>
        </p>
      ) : (
        <div>
          <button
            type="button"
            onClick={confirm}
            disabled={confirmState === "pending" || title.trim().length < 3}
            className="rounded-md bg-ink-100 px-4 py-2 text-sm font-semibold text-black hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {confirmState === "pending" ? "Creating…" : confirmState === "error" ? "Retry — create order" : "Create order"}
          </button>
        </div>
      )}
      </div>
    </details>
  );
}
