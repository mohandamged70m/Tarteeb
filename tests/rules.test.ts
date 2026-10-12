import { describe, expect, it } from "vitest";
import { ORDER_TRANSITIONS, TASK_TRANSITIONS, taskProgress, isOverdue } from "@/lib/types";
import type { Order } from "@/lib/types";

describe("order transitions", () => {
  it("allows draft → ready → in_progress → delivered → completed", () => {
    expect(ORDER_TRANSITIONS.draft).toContain("ready");
    expect(ORDER_TRANSITIONS.ready).toContain("in_progress");
    expect(ORDER_TRANSITIONS.in_progress).toContain("delivered");
    expect(ORDER_TRANSITIONS.delivered).toContain("completed");
  });
  it("forbids skipping (draft → completed)", () => {
    expect(ORDER_TRANSITIONS.draft).not.toContain("completed");
  });
  it("terminal states have no exits", () => {
    expect(ORDER_TRANSITIONS.completed).toEqual([]);
    expect(ORDER_TRANSITIONS.cancelled).toEqual([]);
  });
  it("task transitions are reversible but constrained", () => {
    expect(TASK_TRANSITIONS.todo).toEqual(["in_progress", "done"]);
    expect(TASK_TRANSITIONS.done).toContain("todo");
  });
});

describe("derived progress", () => {
  it("computes done/total without stored state", () => {
    const tasks = [
      { status: "done" },
      { status: "todo" },
      { status: "in_progress" },
      { status: "done" },
    ] as never[];
    expect(taskProgress(tasks as never)).toEqual({ done: 2, total: 4, pct: 50 });
  });
  it("empty task list is 0%", () => {
    expect(taskProgress([])).toEqual({ done: 0, total: 0, pct: 0 });
  });
});

describe("overdue", () => {
  const base = { deadlineDate: "2026-10-10", status: "in_progress" } as Order;
  it("flags past deadlines on active orders", () => {
    expect(isOverdue(base, "2026-10-13")).toBe(true);
  });
  it("ignores delivered/completed/cancelled", () => {
    expect(isOverdue({ ...base, status: "delivered" }, "2026-10-13")).toBe(false);
    expect(isOverdue({ ...base, status: "completed" }, "2026-10-13")).toBe(false);
  });
  it("ignores missing deadlines", () => {
    expect(isOverdue({ ...base, deadlineDate: null }, "2026-10-13")).toBe(false);
  });
});
