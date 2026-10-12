import type {
  ActivityEntry,
  AISettings,
  ChatMessage,
  Client,
  Conversation,
  ID,
  Order,
  OrderStatus,
  OrderTask,
  Profile,
  Proposal,
  ProposalPayload,
  TaskStatus,
} from "./types";

/** Storage interface shared by the local (dev) and Supabase (prod) backends. */
export interface Repo {
  // profiles
  getProfile(userId: ID): Promise<Profile | null>;
  getProfileByEmail(email: string): Promise<Profile | null>;
  createProfile(p: Profile & { passwordHash?: string }): Promise<Profile>;
  updateProfile(userId: ID, patch: Partial<Profile>): Promise<Profile>;
  verifyPassword(userId: ID, password: string): Promise<boolean>;

  // clients
  listClients(userId: ID, search?: string): Promise<Client[]>;
  getClient(userId: ID, id: ID): Promise<Client | null>;
  createClient(userId: ID, data: { name: string; contact: string | null; notes: string | null }): Promise<Client>;
  updateClient(userId: ID, id: ID, patch: Partial<Pick<Client, "name" | "contact" | "notes">>): Promise<Client | null>;
  deleteClient(userId: ID, id: ID): Promise<boolean>;

  // conversations + messages
  listConversations(userId: ID): Promise<Conversation[]>;
  getConversation(userId: ID, id: ID): Promise<Conversation | null>;
  createConversation(userId: ID, title: string): Promise<Conversation>;
  updateConversation(userId: ID, id: ID, patch: Partial<Pick<Conversation, "title" | "status">>): Promise<Conversation | null>;
  listMessages(userId: ID, conversationId: ID): Promise<ChatMessage[]>;
  addMessage(userId: ID, conversationId: ID, role: ChatMessage["role"], content: string): Promise<ChatMessage>;

  // proposals
  latestProposal(userId: ID, conversationId: ID): Promise<Proposal | null>;
  getProposal(userId: ID, id: ID): Promise<Proposal | null>;
  saveProposal(userId: ID, conversationId: ID, payload: ProposalPayload, assistantLabel: string): Promise<Proposal>;
  markProposal(userId: ID, id: ID, status: Proposal["status"]): Promise<void>;

  // orders + tasks + activity
  listOrders(userId: ID, opts: { search?: string; status?: OrderStatus | "all"; clientId?: ID; sort?: "created" | "due" }): Promise<(Order & { clientName: string | null })[]>;
  getOrder(userId: ID, id: ID): Promise<Order | null>;
  findOrderByIdempotency(userId: ID, key: ID): Promise<Order | null>;
  orderForProposal(userId: ID, proposalId: ID): Promise<Order | null>;
  createOrderManual(userId: ID, data: ManualOrderData): Promise<Order>;
  confirmIntake(userId: ID, data: ConfirmData): Promise<{ order: Order; created: boolean }>;
  updateOrder(userId: ID, id: ID, patch: Partial<Order>): Promise<Order | null>;
  listTasks(userId: ID, orderId: ID): Promise<OrderTask[]>;
  addTask(userId: ID, orderId: ID, data: { title: string; isClientRequirement: boolean; status: TaskStatus }): Promise<OrderTask | null>;
  updateTask(userId: ID, orderId: ID, taskId: ID, patch: Partial<Pick<OrderTask, "title" | "status">>): Promise<OrderTask | null>;
  deleteTask(userId: ID, orderId: ID, taskId: ID): Promise<boolean>;
  listActivity(userId: ID, orderId: ID): Promise<ActivityEntry[]>;
  ordersForClient(userId: ID, clientId: ID): Promise<Order[]>;

  // ai settings
  getAISettings(userId: ID): Promise<AISettings | null>;
  saveAISettings(userId: ID, s: AISettings & { keyCiphertext: string | null }): Promise<AISettings>;
  getAIKeyCiphertext(userId: ID): Promise<string | null>;
}

export interface ManualOrderData {
  clientId: ID | null;
  title: string;
  description: string | null;
  deliverables: string[];
  requirements: string[];
  deadlineDate: string | null;
  deadlineText: string | null;
  timezone: string;
  budgetAmount: number | null;
  budgetCurrency: string | null;
  tasks: { title: string; isClientRequirement: boolean }[];
}

export interface ConfirmData extends ManualOrderData {
  conversationId: ID;
  proposalId: ID;
  idempotencyKey: ID;
  newClientName: string | null;
}
