"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronLeft, Inbox as InboxIcon, MessageCircle, Search, X } from "lucide-react";
import { ServiceLabel } from "../provider/service-label";
import { MessageThread } from "./message-thread";
import type { MessageInboxThreadBundle } from "./db";
import {
  formatThreadDate,
  formatThreadTime,
  getThreadDetailLine,
  getThreadLifecycleTab,
  getThreadSchedule,
  getThreadStatusLabel,
  getThreadStatusTone,
  getThreadTransactionLine,
  inboxLifecycleTabs,
  type InboxLifecycleTab,
} from "./thread-metadata";

type InboxPopoverProps = {
  currentUserId: string;
  initialThreads: MessageInboxThreadBundle[];
};

function getThreadInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const initials = parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join("");

  return initials || "GH";
}

function formatRelativeTime(value: string) {
  const timestamp = new Date(value).getTime();
  const diffSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));

  if (diffSeconds < 60) return "now";

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d`;

  return `${Math.floor(diffDays / 7)}w`;
}

function getLatestMessage(bundle: MessageInboxThreadBundle) {
  return bundle.latestMessage ?? bundle.messages[bundle.messages.length - 1] ?? null;
}

function getThreadActivityAt(bundle: MessageInboxThreadBundle) {
  return getLatestMessage(bundle)?.createdAt ?? bundle.thread.updatedAt;
}

function getThreadPreview(bundle: MessageInboxThreadBundle, currentUserId: string) {
  const latestMessage = getLatestMessage(bundle);

  if (!latestMessage) return "No messages yet";

  const prefix = latestMessage.senderUserId === currentUserId ? "You: " : "";

  return `${prefix}${latestMessage.body}`;
}

export function InboxPopover({ currentUserId, initialThreads }: InboxPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<InboxLifecycleTab>("current");
  const [query, setQuery] = useState("");
  const [selectedThreadId, setSelectedThreadId] = useState<number | null>(null);
  const [threadBundles, setThreadBundles] = useState(initialThreads);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const popoverId = useId();
  const unreadThreadCount = threadBundles.filter((bundle) => bundle.thread.unreadCount > 0).length;
  const normalizedQuery = query.trim().toLowerCase();
  const selectedBundle = useMemo(
    () => threadBundles.find((bundle) => bundle.thread.id === selectedThreadId) ?? null,
    [selectedThreadId, threadBundles],
  );
  const tabCounts = useMemo(
    () =>
      inboxLifecycleTabs.reduce(
        (counts, tab) => ({
          ...counts,
          [tab.value]: threadBundles.filter((bundle) => getThreadLifecycleTab(bundle.thread) === tab.value).length,
        }),
        { current: 0, upcoming: 0, past: 0 } satisfies Record<InboxLifecycleTab, number>,
      ),
    [threadBundles],
  );
  const visibleBundles = useMemo(
    () =>
      threadBundles.filter((bundle) => {
        if (getThreadLifecycleTab(bundle.thread) !== activeTab) return false;
        if (!normalizedQuery) return true;

        const searchableText = [
          bundle.thread.otherParticipantName,
          bundle.thread.serviceRequestId.toString(),
          bundle.thread.requestProviderMatchId.toString(),
          bundle.thread.serviceType,
          bundle.thread.serviceLabel,
          bundle.thread.zipCode,
          bundle.thread.requestStatus,
          bundle.thread.matchStatus,
          bundle.thread.bookingStatus,
          bundle.thread.urgency,
          getThreadStatusLabel(bundle.thread),
          getThreadTransactionLine(bundle.thread),
          getThreadDetailLine(bundle.thread),
          getThreadPreview(bundle, currentUserId),
        ]
          .join(" ")
          .toLowerCase();

        return searchableText.includes(normalizedQuery);
      }),
    [activeTab, currentUserId, normalizedQuery, threadBundles],
  );
  const activeTabLabel = inboxLifecycleTabs.find((tab) => tab.value === activeTab)?.label ?? "Current";

  useEffect(() => {
    setThreadBundles(initialThreads);
  }, [initialThreads]);

  useEffect(() => {
    if (!isOpen) return;

    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  function openThread(threadId: number) {
    setSelectedThreadId(threadId);
    setThreadBundles((currentBundles) =>
      currentBundles.map((bundle) =>
        bundle.thread.id === threadId
          ? {
              ...bundle,
              thread: {
                ...bundle.thread,
                unreadCount: 0,
              },
            }
          : bundle,
      ),
    );

    void fetch("/api/messages/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId }),
    }).catch(() => undefined);
  }

  return (
    <div className="nav-inbox" ref={containerRef}>
      <button
        aria-controls={popoverId}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className={`nav-link-button nav-inbox-button${isOpen ? " active" : ""}`}
        onClick={() => setIsOpen((open) => !open)}
        type="button"
      >
        <MessageCircle size={16} />
        Inbox
        {unreadThreadCount ? <span className="nav-inbox-badge">{unreadThreadCount}</span> : null}
      </button>

      {isOpen ? (
        <section className="inbox-popover" id={popoverId} aria-label="Inbox" role="dialog">
          <header className="inbox-header">
            <div>
              <span>
                <InboxIcon size={17} />
                Messages
              </span>
              <h2>Inbox</h2>
            </div>
            <button aria-label="Close inbox" className="inbox-icon-button" onClick={() => setIsOpen(false)} type="button">
              <X size={18} />
            </button>
          </header>

          <label className="inbox-search">
            <Search size={18} />
            <span className="sr-only">Search messages</span>
            <input
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search messages"
              type="search"
              value={query}
            />
          </label>

          <div className="inbox-filters" aria-label="Conversation lifecycle tabs">
            {inboxLifecycleTabs.map((tab) => (
              <button
                aria-pressed={activeTab === tab.value}
                className={activeTab === tab.value ? "active" : undefined}
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                type="button"
              >
                {tab.label}
                <span>{tabCounts[tab.value]}</span>
              </button>
            ))}
          </div>

          <div className={`inbox-body${selectedBundle ? " has-selection" : ""}`}>
            <ol className="inbox-thread-list" aria-label="Message threads">
              {visibleBundles.length ? (
                visibleBundles.map((bundle) => {
                  const latestMessage = getLatestMessage(bundle);
                  const isSelected = selectedThreadId === bundle.thread.id;
                  const preview = getThreadPreview(bundle, currentUserId);
                  const statusTone = getThreadStatusTone(bundle.thread);
                  const schedule = getThreadSchedule(bundle.thread);

                  return (
                    <li key={bundle.thread.id}>
                      <button
                        aria-current={isSelected ? "true" : undefined}
                        className={`inbox-thread-row${isSelected ? " active" : ""}`}
                        onClick={() => openThread(bundle.thread.id)}
                        type="button"
                      >
                        <span className="inbox-thread-avatar" aria-hidden="true">
                          {getThreadInitials(bundle.thread.otherParticipantName)}
                        </span>
                        <span className="inbox-thread-copy">
                          <strong>{bundle.thread.otherParticipantName}</strong>
                          <span className="inbox-thread-preview">{preview}</span>
                          <span className="inbox-thread-transaction">
                            <ServiceLabel
                              label={bundle.thread.serviceLabel || "Service"}
                              serviceType={bundle.thread.serviceType}
                              tooltipFocusable={false}
                            />
                            <span aria-hidden="true">·</span>
                            <span>
                              {formatThreadDate(schedule.date)} · {formatThreadTime(schedule.startTime)} -{" "}
                              {formatThreadTime(schedule.endTime)}
                            </span>
                          </span>
                          <span className="inbox-thread-detail">{getThreadDetailLine(bundle.thread)}</span>
                        </span>
                        <span className="inbox-thread-meta">
                          <time dateTime={latestMessage?.createdAt ?? bundle.thread.updatedAt}>
                            {formatRelativeTime(getThreadActivityAt(bundle))}
                          </time>
                          <span className={`thread-status-badge status-${statusTone}`}>
                            {getThreadStatusLabel(bundle.thread)}
                          </span>
                          {bundle.thread.unreadCount ? (
                            <span className="inbox-thread-unread">{bundle.thread.unreadCount}</span>
                          ) : null}
                        </span>
                      </button>
                    </li>
                  );
                })
              ) : (
                <li className="inbox-empty">
                  <MessageCircle size={22} />
                  <strong>
                    {threadBundles.length ? `No ${activeTabLabel.toLowerCase()} threads` : "No conversations yet"}
                  </strong>
                  <span>
                    {threadBundles.length
                      ? "Try a different search or lifecycle tab."
                      : "Messages from request matches will appear here."}
                  </span>
                </li>
              )}
            </ol>

            {selectedBundle ? (
              <section className="inbox-conversation" aria-label="Selected conversation">
                <button className="inbox-back-button" onClick={() => setSelectedThreadId(null)} type="button">
                  <ChevronLeft size={18} />
                  Threads
                </button>
                <MessageThread
                  currentUserId={currentUserId}
                  initialMessages={selectedBundle.messages}
                  thread={{
                    ...selectedBundle.thread,
                    unreadCount: 0,
                  }}
                />
              </section>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
