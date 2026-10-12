import { NextRequest } from "next/server";
import { getRepo, requireSession } from "@/lib/auth";
import { fail, ok, parseBody } from "@/lib/api";
import { taskPatchSchema } from "@/lib/schemas";
import { TASK_TRANSITIONS } from "@/lib/types";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  let s;
  try {
    s = await requireSession();
  } catch {
    return fail("unauthorized", "Sign in required.", { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const parsed = parseBody(taskPatchSchema, body);
  if (!parsed.ok) return parsed.res;
  const { id, taskId } = await params;
  const repo = getRepo();
  const tasks = await repo.listTasks(s.userId, id);
  const current = tasks.find((t) => t.id === taskId);
  if (!current) return fail("not_found", "Task not found.", { status: 404 });
  if (parsed.data.status && parsed.data.status !== current.status) {
    if (!TASK_TRANSITIONS[current.status].includes(parsed.data.status)) {
      return fail("conflict", "Invalid task transition.", { status: 422 });
    }
  }
  const task = await repo.updateTask(s.userId, id, taskId, parsed.data);
  return ok({ task });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  let s;
  try {
    s = await requireSession();
  } catch {
    return fail("unauthorized", "Sign in required.", { status: 401 });
  }
  const { id, taskId } = await params;
  const deleted = await getRepo().deleteTask(s.userId, id, taskId);
  if (!deleted) return fail("not_found", "Task not found.", { status: 404 });
  return ok({ ok: true });
}
