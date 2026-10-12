// End-to-end smoke test against a running server (default http://localhost:3100).
// Exercises: signup → intake message (offline) → answer → confirm → double-confirm
// → order detail → task cycle → illegal transition → cross-user isolation.
const BASE = process.env.SMOKE_BASE ?? "http://localhost:3100";
const stamp = Date.now().toString(36);

let cookie = "";
async function api(path, opts = {}) {
  const res = await fetch(BASE + path, {
    ...opts,
    headers: { "content-type": "application/json", ...(opts.headers ?? {}), cookie },
    redirect: "manual",
  });
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

function check(name, cond, extra = "") {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? "  — " + extra : ""}`);
  if (!cond) process.exitCode = 1;
}

const email = `smoke-${stamp}@example.com`;
{
  const r = await api("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email, password: "password123", displayName: "Smoke", timezone: "Africa/Cairo", defaultCurrency: "EGP" }),
  });
  check("signup 200", r.status === 200, JSON.stringify(r.json)?.slice(0, 120));
}
{
  const r = await api("/api/conversations", { method: "POST", body: JSON.stringify({}) });
  check("new conversation", (r.status === 200 || r.status === 201) && r.json.conversation?.id, "");
  var convId = r.json.conversation.id;
}
{
  const r = await api("/api/intake/message", {
    method: "POST",
    body: JSON.stringify({ conversationId: convId, content: "Ahmed wants a landing page for his gym next Friday.", timezone: "Africa/Cairo" }),
  });
  check("intake message → proposal", r.status === 200 && r.json.proposal?.payload?.clientName === "Ahmed", `status=${r.status}`);
  check("offline assistant labelled", /Offline/.test(r.json.proposal?.assistantLabel ?? ""), r.json.proposal?.assistantLabel);
  check("budget stays unknown", r.json.proposal?.payload?.budget?.unknown === true, "");
  check("clarification asked", (r.json.proposal?.payload?.missingEssential?.length ?? 0) > 0, "");
  var proposalId = r.json.proposal.id;
}
{
  const r = await api("/api/intake/answer", {
    method: "POST",
    body: JSON.stringify({ conversationId: convId, answers: [{ questionId: "scope", field: "scope", answer: "5 sections, content from client Thursday" }] }),
  });
  check("answer refines proposal", r.status === 200 && r.json.proposal?.id, `status=${r.status}`);
  proposalId = r.json.proposal.id;
}
const idem = crypto.randomUUID();
let orderId;
{
  const body = {
    conversationId: convId, proposalId, idempotencyKey: idem,
    clientId: null, newClientName: "Ahmed",
    title: "Landing page — Ahmed", description: "Gym landing page",
    deliverables: ["Landing page"], requirements: ["Landing page"],
    deadlineDate: r_deadline(), deadlineText: "next Friday",
    budgetAmount: null, budgetCurrency: null,
    tasks: [{ title: "Design", isClientRequirement: true }],
  };
  function r_deadline() { return "2026-10-23"; }
  const r1 = await api("/api/intake/confirm", { method: "POST", headers: { "Idempotency-Key": idem }, body: JSON.stringify(body) });
  check("confirm creates order", r1.status === 201 && r1.json.created === true, `status=${r1.status}`);
  orderId = r1.json.order?.id;
  const r2 = await api("/api/intake/confirm", { method: "POST", headers: { "Idempotency-Key": idem }, body: JSON.stringify(body) });
  check("double confirm → same order, no duplicate", r2.status === 200 && r2.json.order?.id === orderId && r2.json.created === false, `status=${r2.status}`);
}
{
  const r = await api(`/api/orders/${orderId}`);
  check("order detail loads with task", r.status === 200 && r.json.tasks?.length === 1, `status=${r.status}`);
  var taskId = r.json.tasks[0].id;
}
{
  const r = await api(`/api/orders/${orderId}/tasks/${taskId}`, { method: "PATCH", body: JSON.stringify({ status: "done" }) });
  check("task todo → done", r.status === 200 && r.json.task?.status === "done", `status=${r.status}`);
}
{
  const r = await api(`/api/orders/${orderId}`, { method: "PATCH", body: JSON.stringify({ status: "completed" }) });
  check("illegal draft → completed rejected", r.status === 422, `status=${r.status}`);
}
{
  const r = await api(`/api/orders/${orderId}`, { method: "PATCH", body: JSON.stringify({ status: "ready" }) });
  check("legal draft → ready accepted", r.status === 200, `status=${r.status}`);
}
// Second user isolation
{
  const r = await api("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email: `smoke2-${stamp}@example.com`, password: "password123", displayName: "Smoke2" }),
  });
  check("second user signup", r.status === 200, `status=${r.status}`);
  const r2 = await api(`/api/orders/${orderId}`);
  check("cross-user order hidden (404)", r2.status === 404, `status=${r2.status}`);
}
console.log("SMOKE DONE");
