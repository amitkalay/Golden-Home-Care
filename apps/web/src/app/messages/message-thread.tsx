"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import Pusher from "pusher-js";
import type { MessageRecord, MessageThreadRecord } from "./db";
import {
  getThreadDetailLine,
  getThreadStatusLabel,
  getThreadStatusTone,
  getThreadTransactionLine,
} from "./thread-metadata";

type MessageThreadProps = {
  currentUserId: string;
  thread: MessageThreadRecord;
  initialMessages: MessageRecord[];
};

function formatMessageTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function appendMessage(messages: MessageRecord[], message: MessageRecord) {
  if (messages.some((existing) => existing.id === message.id)) {
    return messages;
  }

  return [...messages, message].sort((a, b) => {
    const createdDiff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    return createdDiff || a.id - b.id;
  });
}

export function MessageThread({ currentUserId, thread, initialMessages }: MessageThreadProps) {
  const [messages, setMessages] = useState(initialMessages);
  const [body, setBody] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const [displayUnreadCount, setDisplayUnreadCount] = useState(thread.unreadCount);
  const statusTone = getThreadStatusTone(thread);
  const messageListRef = useRef<HTMLDivElement | null>(null);
  const pusherKey = process.env.NEXT_PUBLIC_PUSHER_KEY || "";
  const pusherCluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || "";
  const canSubscribe = Boolean(pusherKey && pusherCluster);
  useEffect(() => {
    setMessages(initialMessages);
    setDisplayUnreadCount(thread.unreadCount);
  }, [initialMessages, thread.id, thread.unreadCount]);

  useEffect(() => {
    messageListRef.current?.scrollTo({
      top: messageListRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages.length]);

  useEffect(() => {
    void fetch("/api/messages/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId: thread.id }),
    })
      .then(() => setDisplayUnreadCount(0))
      .catch(() => undefined);
  }, [messages.length, thread.id]);

  useEffect(() => {
    if (!canSubscribe) return;

    const pusher = new Pusher(pusherKey, {
      cluster: pusherCluster,
      channelAuthorization: {
        endpoint: "/api/pusher/auth",
        transport: "ajax",
      },
    });
    const channel = pusher.subscribe(`private-message-thread-${thread.id}`);
    const onMessageCreated = (message: MessageRecord) => {
      setMessages((currentMessages) => appendMessage(currentMessages, message));
      if (message.senderUserId !== currentUserId) {
        setDisplayUnreadCount((count) => count + 1);
      }
    };

    channel.bind("message-created", onMessageCreated);

    return () => {
      channel.unbind("message-created", onMessageCreated);
      pusher.unsubscribe(`private-message-thread-${thread.id}`);
      pusher.disconnect();
    };
  }, [canSubscribe, currentUserId, pusherCluster, pusherKey, thread.id]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextBody = body.trim();

    if (!nextBody || isSending || !thread.canSend) {
      return;
    }

    setIsSending(true);
    setError("");

    try {
      const response = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId: thread.id, body: nextBody }),
      });

      if (!response.ok) {
        throw new Error("Message could not be sent.");
      }

      const payload = (await response.json()) as { message?: MessageRecord };
      if (payload.message) {
        setMessages((currentMessages) => appendMessage(currentMessages, payload.message as MessageRecord));
      }
      setBody("");
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Message could not be sent.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <section className="message-thread" aria-label={`Messages with ${thread.otherParticipantName}`}>
      <header className="message-thread-header">
        <div className="message-thread-heading">
          <div className="message-thread-title-row">
            <h3>Messages with {thread.otherParticipantName}</h3>
            <span className={`thread-status-badge status-${statusTone}`}>
              {getThreadStatusLabel(thread)}
            </span>
          </div>
          <p className="message-thread-transaction">{getThreadTransactionLine(thread)}</p>
          <p className="message-thread-details">
            {getThreadDetailLine(thread)} · Request #{thread.serviceRequestId} · Match #{thread.requestProviderMatchId}
          </p>
        </div>
        {displayUnreadCount ? (
          <span className="provider-status-badge status-proposed">
            {displayUnreadCount} unread
          </span>
        ) : null}
      </header>

      <div className="message-list" ref={messageListRef}>
        {messages.length ? (
          messages.map((message) => {
            const isMine = message.senderUserId === currentUserId;

            return (
              <article className={`message-bubble${isMine ? " mine" : ""}`} key={message.id}>
                <p>{message.body}</p>
                <time dateTime={message.createdAt}>{formatMessageTime(message.createdAt)}</time>
              </article>
            );
          })
        ) : (
          <p className="message-empty">No messages yet.</p>
        )}
      </div>

      {error ? (
        <p className="message-error" role="alert">
          {error}
        </p>
      ) : null}

      <form className="message-form" onSubmit={sendMessage}>
        <label>
          Message
          <textarea
            maxLength={1000}
            onChange={(event) => setBody(event.target.value)}
            placeholder={
              thread.canSend ? "Write a message..." : "This conversation is closed."
            }
            rows={3}
            value={body}
            disabled={!thread.canSend || isSending}
          />
        </label>
        <button className="button button-primary" type="submit" disabled={!thread.canSend || isSending || !body.trim()}>
          <Send size={17} />
          {isSending ? "Sending" : "Send"}
        </button>
      </form>
    </section>
  );
}
