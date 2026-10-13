import { promises as fs } from "fs";
import path from "path";
import { createHash, randomUUID, timingSafeEqual } from "crypto";
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

function dbPath(): string {
  return process.env.TARTEEB_DB_PATH ?? path.join(process.cwd(), "data", "dev-db.json");
}

const DB_PATH = dbPath();

interface DB {
  profiles: (Profile & { passwordHash?: string })[];
  clients: Client[];
  conversations: Conversation[];
  messages: ChatMessage[];
  proposals: Proposal[];
  orders: Order[];
  tasks: OrderTask[];
  activity: ActivityEntry[];
  aiSettings: (AISettings & { keyCiphertext: string | null })[];
}

const empty: DB = {
  profiles: [],
  clients: [],
  conversations: [],
  messages: [],
  proposals: [],
  orders: [],
  tasks: [],
  activity: [],
  aiSettings: [],
};

let writeChain: Promise<void> = Promise.resolve();

async function load(): Promise<DB> {
  try {
    const raw = await fs.readFile(DB_PATH, "utf8");
    return { ...empty, ...JSON.parse(raw) };
  } catch {
    return structuredClone(empty);
  }
}

/** Atomic write: write temp + rename, serialized through a promise chain. */
function save(db: DB): Promise<void> {
  writeChain = writeChain.then(async () => {
    await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
    const tmp = DB_PATH + ".tmp";
    await fs.writeFile(tmp, JSON.stringify(db, null, 2), "utf8");
    await fs.rename(tmp, DB_PATH);
  });
  return writeChain;
}

const now = () => new Date().toISOString();
const nid = () => randomUUID();

function hashPassword(pw: string, salt: string): string {
  return createHash("sha256").update(salt + "::" + pw).digest("hex");
}

export const localRepo: Repo = {
  async getProfile(userId) {
    const db = await load();
    return db.profiles.find((p) => p.userId === userId) ?? null;
  },
  async getProfileByEmail(email) {
    const db = await load();
    return db.profiles.find((p) => p.email.toLowerCase() === email.toLowerCase()) ?? null;
  },
  async createProfile(p) {
    const db = await load();
    const salt = randomUUID();
    const row = {
      ...p,
      passwordHash: p.passwordHash
        ? `${salt}$${hashPassword(p.passwordHash, salt)}`
        : undefined,
    };
    db.profiles.push(row);
    await save(db);
    const { ...pub } = row;
    return pub;
  },
  async updateProfile(userId, patch) {
    const db = await load();
    const row = db.profiles.find((p) => p.userId === userId);
    if (!row) throw new Error("profile not found");
    Object.assign(row, patch);
    await save(db);
    return row;
  },
  async verifyPassword(userId, password) {
    const db = await load();
    const row = db.profiles.find((p) => p.userId === userId);
    if (!row?.passwordHash) return false;
    const [salt, hash] = row.passwordHash.split("$");
    const candidate = hashPassword(password, salt);
    const a = Buffer.from(candidate);
    const b = Buffer.from(hash);
    return a.length === b.length && timingSafeEqual(a, b);
  },

  async listClients(userId, search) {
    const db = await load();
    let rows = db.clients.filter((c) => c.userId === userId);
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter((c) => c.name.toLowerCase().includes(q));
    }
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  },
  async getClient(userId, id) {
    const db = await load();
    return db.clients.find((c) => c.userId === userId && c.id === id) ?? null;
  },
  async createClient(userId, data) {
    const db = await load();
    const row: Client = { id: nid(), userId, createdAt: now(), ...data };
    db.clients.push(row);
    await save(db);
    return row;
  },
  async updateClient(userId, id, patch) {
    const db = await load();
    const row = db.clients.find((c) => c.userId === userId && c.id === id);
    if (!row) return null;
    Object.assign(row, patch);
    await save(db);
    return row;
  },
  async deleteClient(userId, id) {
    const db = await load();
    const hasOrders = db.orders.some((o) => o.userId === userId && o.clientId === id);
    if (hasOrders) return false;
    const i = db.clients.findIndex((c) => c.userId === userId && c.id === id);
    if (i < 0) return false;
    db.clients.splice(i, 1);
    await save(db);
    return true;
  },

  async listConversations(userId) {
    const db = await load();
    return db.conversations
      .filter((c) => c.userId === userId)
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  },
  async getConversation(userId, id) {
    const db = await load();
    return db.conversations.find((c) => c.userId === userId && c.id === id) ?? null;
  },
  async createConversation(userId, title) {
    const db = await load();
    const row: Conversation = {
      id: nid(), userId, title, status: "open",
      createdAt: now(), updatedAt: now(),
    };
    db.conversations.push(row);
    await save(db);
    return row;
  },
  async updateConversation(userId, id, patch) {
    const db = await load();
    const row = db.conversations.find((c) => c.userId === userId && c.id === id);
    if (!row) return null;
    Object.assign(row, patch, { updatedAt: now() });
    await save(db);
    return row;
  },
  async listMessages(userId, conversationId) {
    const db = await load();
    const conv = db.conversations.find((c) => c.userId === userId && c.id === conversationId);
    if (!conv) return [];
    return db.messages
      .filter((m) => m.conversationId === conversationId)
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  },
  async addMessage(userId, conversationId, role, content) {
    const db = await load();
    const conv = db.conversations.find((c) => c.userId === userId && c.id === conversationId);
    if (!conv) throw new Error("conversation not found");
    const row: ChatMessage = { id: nid(), conversationId, userId, role, content, createdAt: now() };
    db.messages.push(row);
    conv.updatedAt = now();
    if (role === "user" && db.messages.filter((m) => m.conversationId === conversationId).length <= 1) {
      conv.title = content.slice(0, 60) + (content.length > 60 ? "…" : "");
    }
    await save(db);
    return row;
  },

  async latestProposal(userId, conversationId) {
    const db = await load();
    const rows = db.proposals.filter(
      (p) => p.userId === userId && p.conversationId === conversationId
    );
    return rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0] ?? null;
  },
  async getProposal(userId, id) {
    const db = await load();
    return db.proposals.find((p) => p.userId === userId && p.id === id) ?? null;
  },
  async saveProposal(userId, conversationId, payload: ProposalPayload, assistantLabel: string) {
    const db = await load();
    for (const p of db.proposals) {
      if (p.userId === userId && p.conversationId === conversationId && p.status !== "confirmed") {
        p.status = "superseded";
      }
    }
    const row: Proposal = {
      id: nid(), conversationId, userId, payload,
      status: payload.missingEssential.length > 0 ? "draft" : "ready",
      idempotencyKey: randomUUID(), assistantLabel, createdAt: now(),
    };
    db.proposals.push(row);
    await save(db);
    return row;
  },
  async markProposal(userId, id, status) {
    const db = await load();
    const row = db.proposals.find((p) => p.userId === userId && p.id === id);
    if (!row) return;
    row.status = status;
    await save(db);
  },

  async listOrders(userId, opts) {
    const db = await load();
    let rows = db.orders.filter((o) => o.userId === userId);
    if (opts.status && opts.status !== "all") rows = rows.filter((o) => o.status === opts.status);
    if (opts.clientId) rows = rows.filter((o) => o.clientId === opts.clientId);
    if (opts.search) {
      const q = opts.search.toLowerCase();
      const clientNames = new Map(db.clients.map((c) => [c.id, c.name.toLowerCase()]));
      rows = rows.filter(
        (o) => o.title.toLowerCase().includes(q) || (o.clientId && (clientNames.get(o.clientId) ?? "").includes(q))
      );
    }
    const withNames = rows.map((o) => ({
      ...o,
      clientName: o.clientId ? db.clients.find((c) => c.id === o.clientId)?.name ?? null : null,
    }));
    if (opts.sort === "due") {
      withNames.sort((a, b) => (a.deadlineDate ?? "9999") < (b.deadlineDate ?? "9999") ? -1 : 1);
    } else {
      withNames.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    }
    return withNames;
  },
  async getOrder(userId, id) {
    const db = await load();
    return db.orders.find((o) => o.userId === userId && o.id === id) ?? null;
  },
  async findOrderByIdempotency(userId, key) {
    const db = await load();
    return db.orders.find((o) => o.userId === userId && o.idempotencyKey === key) ?? null;
  },
  async orderForProposal(userId, proposalId) {
    const db = await load();
    return db.orders.find((o) => o.userId === userId && o.proposalId === proposalId) ?? null;
  },
  async createOrderManual(userId, data: ManualOrderData) {
    const db = await load();
    const row: Order = {
      id: nid(), userId, clientId: data.clientId, conversationId: null, proposalId: null,
      idempotencyKey: null, title: data.title, description: data.description,
      deliverables: data.deliverables, requirements: data.requirements,
      deadlineDate: data.deadlineDate, deadlineText: data.deadlineText,
      timezone: data.timezone, budgetAmount: data.budgetAmount,
      budgetCurrency: data.budgetCurrency, status: "draft",
      createdAt: now(), updatedAt: now(),
    };
    db.orders.push(row);
    data.tasks.forEach((t, i) =>
      db.tasks.push({ id: nid(), orderId: row.id, userId, title: t.title, isClientRequirement: t.isClientRequirement, status: "todo", position: i, createdAt: now() })
    );
    db.activity.push({ id: nid(), orderId: row.id, userId, kind: "created", detail: "Order created", createdAt: now() });
    await save(db);
    return row;
  },
  /** Atomic (single serialized write batch) + idempotent via unique key. */
  async confirmIntake(userId, data: ConfirmData) {
    const existing = await this.findOrderByIdempotency(userId, data.idempotencyKey);
    if (existing) return { order: existing, created: false };
    const db = await load();
    // Re-check inside the batch (double-submit race within one process).
    const dup = db.orders.find((o) => o.userId === userId && o.idempotencyKey === data.idempotencyKey);
    if (dup) return { order: dup, created: false };
    const conv = db.conversations.find((c) => c.userId === userId && c.id === data.conversationId);
    if (!conv) throw new Error("conversation not found");
    const prop = db.proposals.find((p) => p.userId === userId && p.id === data.proposalId);
    if (!prop || prop.conversationId !== data.conversationId) throw new Error("proposal not owned by conversation");
    if (prop.status === "superseded") throw new Error("proposal is no longer current");
    let clientId = data.clientId;
    if (clientId) {
      const ok = db.clients.some((c) => c.userId === userId && c.id === clientId);
      if (!ok) throw new Error("client not owned");
    } else if (data.newClientName) {
      const c: Client = { id: nid(), userId, name: data.newClientName, contact: null, notes: null, createdAt: now() };
      db.clients.push(c);
      clientId = c.id;
    }
    const row: Order = {
      id: nid(), userId, clientId, conversationId: data.conversationId, proposalId: data.proposalId,
      idempotencyKey: data.idempotencyKey, title: data.title, description: data.description,
      deliverables: data.deliverables, requirements: data.requirements,
      deadlineDate: data.deadlineDate, deadlineText: data.deadlineText,
      timezone: data.timezone, budgetAmount: data.budgetAmount,
      budgetCurrency: data.budgetCurrency, status: "draft",
      createdAt: now(), updatedAt: now(),
    };
    db.orders.push(row);
    data.tasks.forEach((t, i) =>
      db.tasks.push({ id: nid(), orderId: row.id, userId, title: t.title, isClientRequirement: t.isClientRequirement, status: "todo", position: i, createdAt: now() })
    );
    prop.status = "confirmed";
    conv.status = "confirmed";
    db.activity.push({ id: nid(), orderId: row.id, userId, kind: "confirmed", detail: "Order confirmed from intake", createdAt: now() });
    await save(db);
    return { order: row, created: true };
  },
  async updateOrder(userId, id, patch) {
    const db = await load();
    const row = db.orders.find((o) => o.userId === userId && o.id === id);
    if (!row) return null;
    const before = row.status;
    Object.assign(row, patch, { updatedAt: now() });
    await save(db);
    if (patch.status && patch.status !== before) {
      const db2 = await load();
      db2.activity.push({ id: nid(), orderId: id, userId, kind: "status_changed", detail: `Status: ${before} → ${patch.status}`, createdAt: now() });
      await save(db2);
    } else if (patch.title || patch.description || patch.deadlineDate !== undefined || patch.budgetAmount !== undefined) {
      const db2 = await load();
      db2.activity.push({ id: nid(), orderId: id, userId, kind: "edited", detail: "Order edited", createdAt: now() });
      await save(db2);
    }
    return row;
  },
  async listTasks(userId, orderId) {
    const db = await load();
    const order = db.orders.find((o) => o.userId === userId && o.id === orderId);
    if (!order) return [];
    return db.tasks.filter((t) => t.orderId === orderId).sort((a, b) => a.position - b.position);
  },
  async addTask(userId, orderId, data) {
    const db = await load();
    const order = db.orders.find((o) => o.userId === userId && o.id === orderId);
    if (!order) return null;
    const position = db.tasks.filter((t) => t.orderId === orderId).length;
    const row: OrderTask = { id: nid(), orderId, userId, position, createdAt: now(), ...data };
    db.tasks.push(row);
    db.activity.push({ id: nid(), orderId, userId, kind: "task_added", detail: `Task added: ${data.title}`, createdAt: now() });
    await save(db);
    return row;
  },
  async updateTask(userId, orderId, taskId, patch) {
    const db = await load();
    const row = db.tasks.find((t) => t.orderId === orderId && t.id === taskId && t.userId === userId);
    if (!row) return null;
    Object.assign(row, patch);
    db.activity.push({ id: nid(), orderId, userId, kind: "task_updated", detail: `Task updated: ${row.title}`, createdAt: now() });
    await save(db);
    return row;
  },
  async deleteTask(userId, orderId, taskId) {
    const db = await load();
    const i = db.tasks.findIndex((t) => t.orderId === orderId && t.id === taskId && t.userId === userId);
    if (i < 0) return false;
    const [removed] = db.tasks.splice(i, 1);
    db.activity.push({ id: nid(), orderId, userId, kind: "task_removed", detail: `Task removed: ${removed.title}`, createdAt: now() });
    await save(db);
    return true;
  },
  async listActivity(userId, orderId) {
    const db = await load();
    const order = db.orders.find((o) => o.userId === userId && o.id === orderId);
    if (!order) return [];
    return db.activity.filter((a) => a.orderId === orderId).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  },
  async ordersForClient(userId, clientId) {
    const db = await load();
    return db.orders
      .filter((o) => o.userId === userId && o.clientId === clientId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  },
  async getAISettings(userId) {
    const db = await load();
    return db.aiSettings.find((s) => s.userId === userId) ?? null;
  },
  async saveAISettings(userId, s) {
    const db = await load();
    const i = db.aiSettings.findIndex((x) => x.userId === userId);
    const row = { ...s, userId, updatedAt: now() };
    if (i < 0) db.aiSettings.push(row);
    else db.aiSettings[i] = row;
    await save(db);
    return row;
  },
  async getAIKeyCiphertext(userId) {
    const db = await load();
    return db.aiSettings.find((s) => s.userId === userId)?.keyCiphertext ?? null;
  },
};
