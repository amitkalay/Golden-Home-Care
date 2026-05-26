import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "../../../lib/auth";
import { markMessageThreadReadForUser } from "../../../messages/db";
import { markMessageNotificationsReadForUser } from "../../../notifications/db";

function parseThreadId(value: unknown) {
  const threadId = Number.parseInt(String(value ?? ""), 10);

  return Number.isInteger(threadId) && threadId > 0 ? threadId : null;
}

async function readJson(request: Request) {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await readJson(request);
  const threadId = parseThreadId(payload.threadId);

  if (!threadId) {
    return NextResponse.json({ error: "Invalid message thread" }, { status: 400 });
  }

  const readThread = await markMessageThreadReadForUser(threadId, userId);

  if (!readThread) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await markMessageNotificationsReadForUser({
    userId,
    serviceRequestId: readThread.serviceRequestId,
    requestProviderMatchId: readThread.requestProviderMatchId,
  });

  return NextResponse.json({ ok: true });
}
