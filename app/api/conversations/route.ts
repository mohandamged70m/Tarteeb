import { NextRequest } from "next/server";
import { getRepo, requireSession } from "@/lib/auth";
import { fail, ok } from "@/lib/api";

export async function GET() {
  try {
    const s = await requireSession();
    const convs = await getRepo().listConversations(s.userId);
    return ok({ conversations: convs });
  } catch {
    return fail("unauthorized", "Sign in required.", { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const s = await requireSession();
    const body = await req.json().catch(() => ({}));
    const title = typeof body?.title === "string" && body.title.trim()
      ? body.title.trim().slice(0, 120)
      : "New intake";
    const conv = await getRepo().createConversation(s.userId, title);
    return ok({ conversation: conv }, 201);
  } catch {
    return fail("unauthorized", "Sign in required.", { status: 401 });
  }
}
