import Pusher from "pusher";

let pusherClient: Pusher | null = null;

export type RealtimeMessagePayload = {
  id: number;
  threadId: number;
  senderUserId: string;
  body: string;
  createdAt: string;
};

function getPusherConfig() {
  const appId = process.env.PUSHER_APP_ID;
  const key = process.env.PUSHER_KEY;
  const secret = process.env.PUSHER_SECRET;
  const cluster = process.env.PUSHER_CLUSTER;

  if (!appId || !key || !secret || !cluster) {
    return null;
  }

  return { appId, key, secret, cluster };
}

export function getPusherServer() {
  const config = getPusherConfig();

  if (!config) {
    return null;
  }

  if (!pusherClient) {
    pusherClient = new Pusher({
      ...config,
      useTLS: true,
    });
  }

  return pusherClient;
}

export function getMessageThreadChannelName(threadId: number) {
  return `private-message-thread-${threadId}`;
}

export function parseMessageThreadChannelName(channelName: string) {
  const match = /^private-message-thread-(\d+)$/.exec(channelName);
  if (!match) return null;

  const threadId = Number.parseInt(match[1], 10);
  return Number.isInteger(threadId) && threadId > 0 ? threadId : null;
}

export async function publishMessageCreated(payload: RealtimeMessagePayload) {
  const pusher = getPusherServer();

  if (!pusher) {
    return false;
  }

  try {
    await pusher.trigger(getMessageThreadChannelName(payload.threadId), "message-created", payload);
    return true;
  } catch (error) {
    console.error("Failed to publish message-created event", error);
    return false;
  }
}
