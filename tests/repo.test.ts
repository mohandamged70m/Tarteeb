import { describe, expect, it } from "vitest";
import { randomUUID } from "crypto";
import { localRepo as repo } from "@/lib/repo.local";

const uid = () => `u-${randomUUID()}`;

async function setupUser() {
  const userId = uid();
  await repo.createProfile({
    userId,
    email: `${userId}@example.com`,
    displayName: "Test",
    timezone: "Africa/Cairo",
    defaultCurrency: "EGP",
    createdAt: new Date().toISOString(),
    passwordHash: "password123",
  });
  return userId;
}

describe("idempotent confirmation", () => {
  it("double confirm creates exactly one order with correct tasks", async () => {
    const userId = await setupUser();
    const conv = await repo.createConversation(userId, "intake");
    const proposal = await repo.saveProposal(
      userId,
      conv.id,
      {
        title: "Landing page",
        summary: "s",
        clientName: null,
        deliverables: ["Landing page"],
        requirements: [],
        deadline: { dateISO: null, textOriginal: null, ambiguous: false, interpretation: null },
        budget: { amount: null, currency: null, unknown: true },
        tasks: [{ title: "Design", isClientRequirement: true }],
        missingEssential: [],
        optionalUnknowns: [],
        assumptions: [],
        language: "en",
      },
      "test"
    );
    const key = randomUUID();
    const data = {
      conversationId: conv.id,
      proposalId: proposal.id,
      idempotencyKey: key,
      clientId: null,
      newClientName: null,
      title: "Landing page",
      description: null,
      deliverables: ["Landing page"],
      requirements: [] as string[],
      deadlineDate: null,
      deadlineText: null,
      timezone: "Africa/Cairo",
      budgetAmount: null,
      budgetCurrency: null,
      tasks: [
        { title: "Design", isClientRequirement: true },
        { title: "Build", isClientRequirement: false },
      ],
    };
    const first = await repo.confirmIntake(userId, data);
    const second = await repo.confirmIntake(userId, data);
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.order.id).toBe(first.order.id);
    const tasks = await repo.listTasks(userId, first.order.id);
    expect(tasks).toHaveLength(2);
  });
});

describe("authorization", () => {
  it("users cannot see each other's orders, clients, or conversations", async () => {
    const a = await setupUser();
    const b = await setupUser();
    const client = await repo.createClient(a, { name: "Ahmed", contact: null, notes: null });
    const order = await repo.createOrderManual(a, {
      clientId: client.id,
      title: "Secret order",
      description: null,
      deliverables: [],
      requirements: [],
      deadlineDate: null,
      deadlineText: null,
      timezone: "UTC",
      budgetAmount: null,
      budgetCurrency: null,
      tasks: [],
    });
    expect(await repo.getOrder(b, order.id)).toBeNull();
    expect(await repo.getClient(b, client.id)).toBeNull();
    expect((await repo.listOrders(b, {})).some((o) => o.id === order.id)).toBe(false);
    expect(await repo.addTask(b, order.id, { title: "hijack", isClientRequirement: false, status: "todo" })).toBeNull();
    // Cross-user client attachment is rejected at the API layer via getClient check;
    // repo-level: confirmIntake throws "client not owned".
    const conv = await repo.createConversation(b, "x");
    const prop = await repo.saveProposal(b, conv.id, {
      title: "T", summary: "s", clientName: null, deliverables: [], requirements: [],
      deadline: { dateISO: null, textOriginal: null, ambiguous: false, interpretation: null },
      budget: { amount: null, currency: null, unknown: true }, tasks: [],
      missingEssential: [], optionalUnknowns: [], assumptions: [], language: "en",
    }, "t");
    await expect(
      repo.confirmIntake(b, {
        conversationId: conv.id, proposalId: prop.id, idempotencyKey: randomUUID(),
        clientId: client.id, newClientName: null, title: "T", description: null,
        deliverables: [], requirements: [], deadlineDate: null, deadlineText: null,
        timezone: "UTC", budgetAmount: null, budgetCurrency: null, tasks: [],
      })
    ).rejects.toThrow("client not owned");
  });

  it("password verification accepts correct and rejects wrong passwords", async () => {
    const userId = await setupUser();
    expect(await repo.verifyPassword(userId, "password123")).toBe(true);
    expect(await repo.verifyPassword(userId, "wrong")).toBe(false);
  });
});
