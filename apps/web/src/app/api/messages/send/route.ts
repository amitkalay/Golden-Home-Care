import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "../../../lib/auth";
import { publishMessageCreated } from "../../../lib/realtime";
import { insertMessageForUser } from "../../../messages/db";
import { parseMessageBody } from "../../../messages/validation.js";
import { notifyRecipientOfMessage } from "../../../notifications/db";

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
  const parsedMessage = parseMessageBody(payload);

  if (!threadId || !parsedMessage.ok) {
    return NextResponse.json({ error: "Invalid message" }, { status: 400 });
  }

  const sendResult = await insertMessageForUser(threadId, userId, parsedMessage.data.body);

  if (!sendResult) {
    return NextResponse.json({ error: "Thread is not available for messaging" }, { status: 403 });
  }

  const recipientIsProvider = sendResult.recipientUserId === sendResult.thread.providerUserId;
  const href = recipientIsProvider
    ? `/provider/messages#message-thread-${sendResult.thread.requestProviderMatchId}`
    : `/requests/${sendResult.thread.serviceRequestId}#message-thread-${sendResult.thread.requestProviderMatchId}`;

  try {
    await notifyRecipientOfMessage({
      messageId: sendResult.message.id,
      recipientUserId: sendResult.recipientUserId,
      senderName: sendResult.senderName,
      body: sendResult.message.body,
      href,
      serviceRequestId: sendResult.thread.serviceRequestId,
      requestProviderMatchId: sendResult.thread.requestProviderMatchId,
    });
  } catch (error) {
    console.error("Failed to create message notification", error);
  }

  await publishMessageCreated(sendResult.message);

  return NextResponse.json({ message: sendResult.message });
}
