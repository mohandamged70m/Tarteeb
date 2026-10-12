import type {
  ActivityEntry,
  AISettings,
  ChatMessage,
  Client,
  Conversation,
  ID,
  Order,
  OrderTask,
  Profile,
  Proposal,
  ProposalPayload,
} from "./types";
import type { ConfirmData, ManualOrderData, Repo } from "./repo";
import { supabaseAdmin } from "./supabase";

/**
 * Supabase-backed repository. Every query is scoped by user_id (RLS is the
 * backstop; these explicit filters are the primary enforcement for the app).
 * Uses the service-role client because route handlers run server-side after
 * session verification in lib/auth.ts.
 */
function must<T>(data: T | null, what: string): NonNullable<T> {
  if (data == null) throw new Error(`${what} not found`);
  return data as NonNullable<T>;
}

const mapProfile = (r: Record<string, unknown>): Profile => ({
  userId: r["user_id"] as string,
  email: r["email"] as string,
  displayName: r["display_name"] as string,
  timezone: r["timezone"] as string,
  defaultCurrency: r["default_currency"] as string,
  createdAt: r["created_at"] as string,
});

const mapClient = (r: Record<string, unknown>): Client => ({
  id: r["id"] as string,
  userId: r["user_id"] as string,
  name: r["name"] as string,
  contact: (r["contact"] as string) ?? null,
  notes: (r["notes"] as string) ?? null,
  createdAt: r["created_at"] as string,
});

const mapConv = (r: Record<string, unknown>): Conversation => ({
  id: r["id"] as string,
  userId: r["user_id"] as string,
  title: r["title"] as string,
  status: r["status"] as Conversation["status"],
  createdAt: r["created_at"] as string,
  updatedAt: r["updated_at"] as string,
});

const mapMsg = (r: Record<string, unknown>): ChatMessage => ({
  id: r["id"] as string,
  conversationId: r["conversation_id"] as string,
  userId: r["user_id"] as string,
  role: r["role"] as ChatMessage["role"],
  content: r["content"] as string,
  createdAt: r["created_at"] as string,
});

const mapProposal = (r: Record<string, unknown>): Proposal => ({
  id: r["id"] as string,
  conversationId: r["conversation_id"] as string,
  userId: r["user_id"] as string,
  payload: r["payload"] as ProposalPayload,
  status: r["status"] as Proposal["status"],
  idempotencyKey: r["idempotency_key"] as string,
  assistantLabel: (r["assistant_label"] as string) ?? "AI assistant",
  createdAt: r["created_at"] as string,
});

const mapOrder = (r: Record<string, unknown>): Order => ({
  id: r["id"] as string,
  userId: r["user_id"] as string,
  clientId: (r["client_id"] as string) ?? null,
  conversationId: (r["conversation_id"] as string) ?? null,
  proposalId: (r["proposal_id"] as string) ?? null,
  idempotencyKey: (r["idempotency_key"] as string) ?? null,
  title: r["title"] as string,
  description: (r["description"] as string) ?? null,
  deliverables: (r["deliverables"] as string[]) ?? [],
  requirements: (r["requirements"] as string[]) ?? [],
  deadlineDate: (r["deadline_date"] as string) ?? null,
  deadlineText: (r["deadline_text"] as string) ?? null,
  timezone: r["timezone"] as string,
  budgetAmount: r["budget_amount"] != null ? Number(r["budget_amount"]) : null,
  budgetCurrency: (r["budget_currency"] as string) ?? null,
  status: r["status"] as Order["status"],
  createdAt: r["created_at"] as string,
  updatedAt: r["updated_at"] as string,
});

const mapTask = (r: Record<string, unknown>): OrderTask => ({
  id: r["id"] as string,
  orderId: r["order_id"] as string,
  userId: r["user_id"] as string,
  title: r["title"] as string,
  isClientRequirement: Boolean(r["is_client_requirement"]),
  status: r["status"] as OrderTask["status"],
  position: Number(r["position"]),
  createdAt: r["created_at"] as string,
});

export const supabaseRepo: Repo = {
  async getProfile(userId) {
    const db = supabaseAdmin();
    const { data } = await db.from("profiles").select("*").eq("user_id", userId).maybeSingle();
    return data ? mapProfile(data) : null;
  },
  async getProfileByEmail(email) {
    const db = supabaseAdmin();
    const { data } = await db.from("profiles").select("*").ilike("email", email).maybeSingle();
    return data ? mapProfile(data) : null;
  },
  async createProfile(p) {
    // Supabase backend creates profiles via the signup trigger; direct insert
    // is only used by the local backend. Kept for interface parity.
    throw new Error("use Supabase Auth signup (trigger creates profile)");
  },
  async updateProfile(userId, patch) {
    const db = supabaseAdmin();
    const { data } = await db
      .from("profiles")
      .update({
        display_name: patch.displayName,
        timezone: patch.timezone,
        default_currency: patch.defaultCurrency,
      })
      .eq("user_id", userId)
      .select()
      .single();
    return mapProfile(must(data, "profile"));
  },
  async verifyPassword() {
    throw new Error("password verification is handled by Supabase Auth");
  },

  async listClients(userId, search) {
    const db = supabaseAdmin();
    let q = db.from("clients").select("*").eq("user_id", userId).order("name");
    if (search) q = q.ilike("name", `%${search}%`);
    const { data } = await q;
    return (data ?? []).map(mapClient);
  },
  async getClient(userId, id) {
    const db = supabaseAdmin();
    const { data } = await db.from("clients").select("*").eq("user_id", userId).eq("id", id).maybeSingle();
    return data ? mapClient(data) : null;
  },
  async createClient(userId, d) {
    const db = supabaseAdmin();
    const { data } = await db.from("clients").insert({ user_id: userId, name: d.name, contact: d.contact, notes: d.notes }).select().single();
    return mapClient(must(data, "client"));
  },
  async updateClient(userId, id, patch) {
    const db = supabaseAdmin();
    const { data } = await db.from("clients").update({ name: patch.name, contact: patch.contact, notes: patch.notes }).eq("user_id", userId).eq("id", id).select().maybeSingle();
    return data ? mapClient(data) : null;
  },
  async deleteClient(userId, id) {
    const db = supabaseAdmin();
    const { count } = await db.from("orders").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("client_id", id);
    if ((count ?? 0) > 0) return false;
    const { error } = await db.from("clients").delete().eq("user_id", userId).eq("id", id);
    return !error;
  },

  async listConversations(userId) {
    const db = supabaseAdmin();
    const { data } = await db.from("conversations").select("*").eq("user_id", userId).order("updated_at", { ascending: false });
    return (data ?? []).map(mapConv);
  },
  async getConversation(userId, id) {
    const db = supabaseAdmin();
    const { data } = await db.from("conversations").select("*").eq("user_id", userId).eq("id", id).maybeSingle();
    return data ? mapConv(data) : null;
  },
  async createConversation(userId, title) {
    const db = supabaseAdmin();
    const { data } = await db.from("conversations").insert({ user_id: userId, title }).select().single();
    return mapConv(must(data, "conversation"));
  },
  async updateConversation(userId, id, patch) {
    const db = supabaseAdmin();
    const { data } = await db.from("conversations").update({ title: patch.title, status: patch.status }).eq("user_id", userId).eq("id", id).select().maybeSingle();
    return data ? mapConv(data) : null;
  },
  async listMessages(userId, conversationId) {
    const db = supabaseAdmin();
    const conv = await db.from("conversations").select("id").eq("user_id", userId).eq("id", conversationId).maybeSingle();
    if (!conv.data) return [];
    const { data } = await db.from("messages").select("*").eq("conversation_id", conversationId).order("created_at");
    return (data ?? []).map(mapMsg);
  },
  async addMessage(userId, conversationId, role, content) {
    const db = supabaseAdmin();
    const conv = await db.from("conversations").select("id").eq("user_id", userId).eq("id", conversationId).maybeSingle();
    if (!conv.data) throw new Error("conversation not found");
    const { data } = await db.from("messages").insert({ conversation_id: conversationId, user_id: userId, role, content }).select().single();
    return mapMsg(must(data, "message"));
  },

  async latestProposal(userId, conversationId) {
    const db = supabaseAdmin();
    const { data } = await db.from("proposals").select("*").eq("user_id", userId).eq("conversation_id", conversationId).order("created_at", { ascending: false }).limit(1).maybeSingle();
    return data ? mapProposal(data) : null;
  },
  async getProposal(userId, id) {
    const db = supabaseAdmin();
    const { data } = await db.from("proposals").select("*").eq("user_id", userId).eq("id", id).maybeSingle();
    return data ? mapProposal(data) : null;
  },
  async saveProposal(userId, conversationId, payload, assistantLabel) {
    const db = supabaseAdmin();
    await db.from("proposals").update({ status: "superseded" }).eq("user_id", userId).eq("conversation_id", conversationId).neq("status", "confirmed");
    const { data } = await db.from("proposals").insert({
      user_id: userId, conversation_id: conversationId, payload,
      status: payload.missingEssential.length > 0 ? "draft" : "ready",
      assistant_label: assistantLabel,
    }).select().single();
    return mapProposal(must(data, "proposal"));
  },
  async markProposal(userId, id, status) {
    const db = supabaseAdmin();
    await db.from("proposals").update({ status }).eq("user_id", userId).eq("id", id);
  },

  async listOrders(userId, opts) {
    const db = supabaseAdmin();
    let q = db.from("orders").select("*, clients(name)").eq("user_id", userId);
    if (opts.status && opts.status !== "all") q = q.eq("status", opts.status);
    if (opts.clientId) q = q.eq("client_id", opts.clientId);
    if (opts.search) q = q.ilike("title", `%${opts.search}%`);
    q = opts.sort === "due" ? q.order("deadline_date", { ascending: true, nullsFirst: false }) : q.order("created_at", { ascending: false });
    const { data } = await q;
    return (data ?? []).map((r: Record<string, unknown>) => ({
      ...mapOrder(r),
      clientName: ((r["clients"] as Record<string, unknown> | null)?.["name"] as string) ?? null,
    }));
  },
  async getOrder(userId, id) {
    const db = supabaseAdmin();
    const { data } = await db.from("orders").select("*").eq("user_id", userId).eq("id", id).maybeSingle();
    return data ? mapOrder(data) : null;
  },
  async findOrderByIdempotency(userId, key) {
    const db = supabaseAdmin();
    const { data } = await db.from("orders").select("*").eq("user_id", userId).eq("idempotency_key", key).maybeSingle();
    return data ? mapOrder(data) : null;
  },
  async orderForProposal(userId, proposalId) {
    const db = supabaseAdmin();
    const { data } = await db.from("orders").select("*").eq("user_id", userId).eq("proposal_id", proposalId).maybeSingle();
    return data ? mapOrder(data) : null;
  },
  async createOrderManual(userId, data: ManualOrderData) {
    const db = supabaseAdmin();
    if (data.clientId) {
      const c = await db.from("clients").select("id").eq("user_id", userId).eq("id", data.clientId).maybeSingle();
      if (!c.data) throw new Error("client not owned");
    }
    const { data: order } = await db.from("orders").insert({
      user_id: userId, client_id: data.clientId, title: data.title, description: data.description,
      deliverables: data.deliverables, requirements: data.requirements,
      deadline_date: data.deadlineDate, deadline_text: data.deadlineText, timezone: data.timezone,
      budget_amount: data.budgetAmount, budget_currency: data.budgetCurrency, status: "draft",
    }).select().single();
    const o = mapOrder(must(order, "order"));
    if (data.tasks.length) {
      await db.from("order_tasks").insert(data.tasks.map((t, i) => ({ order_id: o.id, user_id: userId, title: t.title, is_client_requirement: t.isClientRequirement, position: i })));
    }
    await db.from("order_activity").insert({ order_id: o.id, user_id: userId, kind: "created", detail: "Order created" });
    return o;
  },
  /** Atomic via the confirm_intake RPC; idempotent on (user_id, idempotency_key). */
  async confirmIntake(userId, data: ConfirmData) {
    const db = supabaseAdmin();
    const { data: out, error } = await db.rpc("confirm_intake", {
      p_user_id: userId,
      p_conversation_id: data.conversationId,
      p_proposal_id: data.proposalId,
      p_idempotency_key: data.idempotencyKey,
      p_client_id: data.clientId,
      p_new_client_name: data.newClientName,
      p_title: data.title,
      p_description: data.description,
      p_deliverables: data.deliverables,
      p_requirements: data.requirements,
      p_deadline_date: data.deadlineDate,
      p_deadline_text: data.deadlineText,
      p_timezone: data.timezone,
      p_budget_amount: data.budgetAmount,
      p_budget_currency: data.budgetCurrency,
      p_tasks: data.tasks.map((t) => ({ title: t.title, is_client_requirement: t.isClientRequirement })),
    });
    if (error) throw new Error(error.message);
    const row = (out as Record<string, unknown>[])?.[0];
    if (!row) throw new Error("confirm failed");
    return { order: mapOrder(row), created: Boolean(row["created"]) };
  },
  async updateOrder(userId, id, patch) {
    const db = supabaseAdmin();
    const before = await db.from("orders").select("status").eq("user_id", userId).eq("id", id).maybeSingle();
    if (!before.data) return null;
    const { data } = await db.from("orders").update({
      title: patch.title, description: patch.description, client_id: patch.clientId,
      deliverables: patch.deliverables, requirements: patch.requirements,
      deadline_date: patch.deadlineDate, deadline_text: patch.deadlineText,
      budget_amount: patch.budgetAmount, budget_currency: patch.budgetCurrency,
      status: patch.status,
    }).eq("user_id", userId).eq("id", id).select().maybeSingle();
    if (!data) return null;
    const prev = (before.data as Record<string, string>)["status"];
    if (patch.status && patch.status !== prev) {
      await db.from("order_activity").insert({ order_id: id, user_id: userId, kind: "status_changed", detail: `Status: ${prev} → ${patch.status}` });
    }
    return mapOrder(data);
  },
  async listTasks(userId, orderId) {
    const db = supabaseAdmin();
    const order = await db.from("orders").select("id").eq("user_id", userId).eq("id", orderId).maybeSingle();
    if (!order.data) return [];
    const { data } = await db.from("order_tasks").select("*").eq("order_id", orderId).order("position");
    return (data ?? []).map(mapTask);
  },
  async addTask(userId, orderId, d) {
    const db = supabaseAdmin();
    const order = await db.from("orders").select("id").eq("user_id", userId).eq("id", orderId).maybeSingle();
    if (!order.data) return null;
    const { count } = await db.from("order_tasks").select("id", { count: "exact", head: true }).eq("order_id", orderId);
    const { data } = await db.from("order_tasks").insert({ order_id: orderId, user_id: userId, title: d.title, is_client_requirement: d.isClientRequirement, status: d.status, position: count ?? 0 }).select().single();
    if (data) await db.from("order_activity").insert({ order_id: orderId, user_id: userId, kind: "task_added", detail: `Task added: ${d.title}` });
    return data ? mapTask(data) : null;
  },
  async updateTask(userId, orderId, taskId, patch) {
    const db = supabaseAdmin();
    const order = await db.from("orders").select("id").eq("user_id", userId).eq("id", orderId).maybeSingle();
    if (!order.data) return null;
    const { data } = await db.from("order_tasks").update({ title: patch.title, status: patch.status }).eq("id", taskId).eq("order_id", orderId).eq("user_id", userId).select().maybeSingle();
    if (data) await db.from("order_activity").insert({ order_id: orderId, user_id: userId, kind: "task_updated", detail: `Task updated: ${(data as Record<string, string>)["title"]}` });
    return data ? mapTask(data) : null;
  },
  async deleteTask(userId, orderId, taskId) {
    const db = supabaseAdmin();
    const order = await db.from("orders").select("id").eq("user_id", userId).eq("id", orderId).maybeSingle();
    if (!order.data) return false;
    const { error } = await db.from("order_tasks").delete().eq("id", taskId).eq("order_id", orderId).eq("user_id", userId);
    return !error;
  },
  async listActivity(userId, orderId) {
    const db = supabaseAdmin();
    const order = await db.from("orders").select("id").eq("user_id", userId).eq("id", orderId).maybeSingle();
    if (!order.data) return [];
    const { data } = await db.from("order_activity").select("*").eq("order_id", orderId).order("created_at", { ascending: false });
    return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
      id: r["id"] as ID,
      orderId: r["order_id"] as ID,
      userId: r["user_id"] as ID,
      kind: r["kind"] as ActivityEntry["kind"],
      detail: r["detail"] as string,
      createdAt: r["created_at"] as string,
    }));
  },
  async ordersForClient(userId, clientId) {
    const db = supabaseAdmin();
    const { data } = await db.from("orders").select("*").eq("user_id", userId).eq("client_id", clientId).order("created_at", { ascending: false });
    return (data ?? []).map(mapOrder);
  },
  async getAISettings(userId) {
    const db = supabaseAdmin();
    const { data } = await db.from("ai_settings").select("*").eq("user_id", userId).maybeSingle();
    if (!data) return null;
    const r = data as Record<string, unknown>;
    return {
      userId, provider: r["provider"] as AISettings["provider"],
      model: r["model"] as string,
      keyHint: (r["key_hint"] as string) ?? null,
      updatedAt: r["updated_at"] as string,
    };
  },
  async saveAISettings(userId, s) {
    const db = supabaseAdmin();
    const { data } = await db.from("ai_settings").upsert({
      user_id: userId, provider: s.provider, model: s.model,
      key_ciphertext: s.keyCiphertext, key_hint: s.keyHint,
    }, { onConflict: "user_id" }).select().single();
    const r = must(data, "ai_settings") as unknown as Record<string, unknown>;
    return {
      userId, provider: r["provider"] as AISettings["provider"],
      model: r["model"] as string,
      keyHint: (r["key_hint"] as string) ?? null,
      updatedAt: r["updated_at"] as string,
    };
  },
  async getAIKeyCiphertext(userId) {
    const db = supabaseAdmin();
    const { data } = await db.from("ai_settings").select("key_ciphertext").eq("user_id", userId).maybeSingle();
    return ((data as Record<string, unknown> | null)?.["key_ciphertext"] as string) ?? null;
  },
};
