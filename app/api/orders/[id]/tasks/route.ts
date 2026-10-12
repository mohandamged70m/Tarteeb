import { NextRequest } from "next/server";
import { getRepo, requireSession } from "@/lib/auth";
import { fail, ok, parseBody } from "@/lib/api";
import { taskCreateSchema } from "@/lib/schemas";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let s;
  try {
    s = await requireSession();
  } catch {
    return fail("unauthorized", "Sign in required.", { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const parsed = parseBody(taskCreateSchema, body);
  if (!parsed.ok) return parsed.res;
  const { id } = await params;
  const task = await getRepo().addTask(s.userId, id, parsed.data);
  if (!task) return fail("not_found", "Order not found.", { status: 404 });
  return ok({ task }, 201);
}
