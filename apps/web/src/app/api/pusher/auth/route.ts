import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "../../../lib/auth";
import { getMessageThreadForUser } from "../../../messages/db";
import { getPusherServer, parseMessageThreadChannelName } from "../../../lib/realtime";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pusher = getPusherServer();
  if (!pusher) {
    return NextResponse.json({ error: "Realtime is not configured" }, { status: 503 });
  }

  const formData = await request.formData();
  const socketId = String(formData.get("socket_id") ?? "");
  const channelName = String(formData.get("channel_name") ?? "");
  const threadId = parseMessageThreadChannelName(channelName);

  if (!socketId || !threadId) {
    return NextResponse.json({ error: "Invalid channel authorization request" }, { status: 400 });
  }

  const thread = await getMessageThreadForUser(threadId, userId);
  if (!thread) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(pusher.authorizeChannel(socketId, channelName));
}
