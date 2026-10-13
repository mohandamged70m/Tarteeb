export type ID = string;

export type OrderStatus =
  | "draft"
  | "ready"
  | "in_progress"
  | "delivered"
  | "completed"
  | "cancelled";

export type TaskStatus = "todo" | "in_progress" | "done";

export type ConversationStatus = "open" | "confirmed";
export type ProposalStatus = "draft" | "ready" | "confirmed" | "superseded";
export type MessageRole = "user" | "assistant" | "system";
export type AIProvider = "openai" | "anthropic" | "google" | "xai" | "deepseek" | "offline";

/** Permitted order transitions. Anything else is rejected with 422. */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  draft: ["ready", "cancelled"],
  ready: ["in_progress", "cancelled"],
  in_progress: ["delivered", "cancelled"],
  delivered: ["completed", "in_progress", "cancelled"],
  completed: [],
  cancelled: [],
};

export const TASK_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  todo: ["in_progress", "done"],
  in_progress: ["todo", "done"],
  done: ["todo", "in_progress"],
};

export const ORDER_STATUS_META: Record<OrderStatus, { label: string; icon: string }> = {
  draft: { label: "Draft", icon: "○" },
  ready: { label: "Ready", icon: "◇" },
  in_progress: { label: "In progress", icon: "▸" },
  delivered: { label: "Delivered", icon: "✓" },
  completed: { label: "Completed", icon: "■" },
  cancelled: { label: "Cancelled", icon: "✕" },
};

export interface Profile {
  userId: ID;
  email: string;
  displayName: string;
  timezone: string;
  defaultCurrency: string;
  createdAt: string;
}

export interface Client {
  id: ID;
  userId: ID;
  name: string;
  contact: string | null;
  notes: string | null;
  createdAt: string;
}

export interface Conversation {
  id: ID;
  userId: ID;
  title: string;
  status: ConversationStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: ID;
  conversationId: ID;
  userId: ID;
  role: MessageRole;
  content: string;
  createdAt: string;
}

export interface ProposalPayload {
  title: string;
  summary: string;
  clientName: string | null;
  deliverables: string[];
  requirements: { text: string; source: "explicit" | "suggested" }[];
  deadline: {
    dateISO: string | null;
    textOriginal: string | null;
    ambiguous: boolean;
    interpretation: string | null;
  };
  budget: { amount: number | null; currency: string | null; unknown: boolean };
  tasks: { title: string; isClientRequirement: boolean }[];
  missingEssential: { field: string; question: string }[];
  optionalUnknowns: string[];
  assumptions: { text: string; needsConfirmation: boolean }[];
  language: "en" | "ar" | "mixed";
}

export interface Proposal {
  id: ID;
  conversationId: ID;
  userId: ID;
  payload: ProposalPayload;
  status: ProposalStatus;
  idempotencyKey: ID;
  assistantLabel: string;
  createdAt: string;
}

export interface Order {
  id: ID;
  userId: ID;
  clientId: ID | null;
  conversationId: ID | null;
  proposalId: ID | null;
  idempotencyKey: ID | null;
  title: string;
  description: string | null;
  deliverables: string[];
  requirements: string[];
  deadlineDate: string | null;
  deadlineText: string | null;
  timezone: string;
  budgetAmount: number | null;
  budgetCurrency: string | null;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
}

export interface OrderTask {
  id: ID;
  orderId: ID;
  userId: ID;
  title: string;
  isClientRequirement: boolean;
  status: TaskStatus;
  position: number;
  createdAt: string;
}

export interface ActivityEntry {
  id: ID;
  orderId: ID;
  userId: ID;
  kind:
    | "created"
    | "status_changed"
    | "edited"
    | "task_added"
    | "task_updated"
    | "task_removed"
    | "confirmed";
  detail: string;
  createdAt: string;
}

export interface AISettings {
  userId: ID;
  provider: AIProvider;
  model: string;
  keyHint: string | null;
  updatedAt: string;
}

export function taskProgress(tasks: OrderTask[]): { done: number; total: number; pct: number } {
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === "done").length;
  return { done, total, pct: total === 0 ? 0 : Math.round((done / total) * 100) };
}

export function isOverdue(o: Order, todayISO: string): boolean {
  if (!o.deadlineDate) return false;
  if (o.status === "delivered" || o.status === "completed" || o.status === "cancelled")
    return false;
  return o.deadlineDate < todayISO;
}
