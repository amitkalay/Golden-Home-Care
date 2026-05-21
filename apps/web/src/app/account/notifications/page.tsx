import Link from "next/link";
import { Bell, CheckCircle2, Home } from "lucide-react";
import { requireUser } from "../../lib/auth";
import {
  getNotificationCount,
  getUnreadNotificationCount,
  getUserNotifications,
  type NotificationRecord,
} from "../../notifications/db";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "../../notifications/actions";

export const dynamic = "force-dynamic";

type NotificationsPageProps = {
  searchParams?: Promise<{
    filter?: string | string[];
    status?: string | string[];
  }>;
};

function getParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function getFilter(value?: string) {
  return value === "all" ? "all" : "unread";
}

function getStatusMessage(status?: string) {
  if (status === "invalid") {
    return { className: "form-alert error", copy: "That notification could not be updated.", role: "alert" };
  }

  if (status === "error") {
    return { className: "form-alert error", copy: "We could not update notifications. Try again.", role: "alert" };
  }

  return null;
}

function formatDate(value: Date | null) {
  if (!value) return "Recently";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

function getEmailStatusLabel(notification: NotificationRecord) {
  if (notification.emailStatus === "sent") return "Email sent";
  if (notification.emailStatus === "failed") return "Email failed";
  if (notification.emailStatus === "skipped") return "Email skipped";
  if (notification.emailStatus === "pending") return "Email pending";
  return null;
}

function NotificationCard({
  notification,
  filter,
}: {
  notification: NotificationRecord;
  filter: "all" | "unread";
}) {
  const emailStatus = getEmailStatusLabel(notification);

  return (
    <article className={`notification-card${notification.readAt ? "" : " unread"}`}>
      <header>
        <span className="notification-icon">
          <Bell size={17} />
        </span>
        <div>
          <h2>{notification.title}</h2>
          <p>{formatDate(notification.createdAt)}</p>
        </div>
        {notification.readAt ? (
          <span className="provider-status-badge">Read</span>
        ) : (
          <span className="provider-status-badge status-proposed">Unread</span>
        )}
      </header>
      <p>{notification.body}</p>
      {emailStatus ? <span className="notification-email-status">{emailStatus}</span> : null}
      <div className="request-actions">
        {notification.href ? (
          <Link className="button button-outline" href={notification.href}>
            View details
          </Link>
        ) : null}
        {!notification.readAt ? (
          <form action={markNotificationRead}>
            <input name="notificationId" type="hidden" value={notification.id} />
            <input name="filter" type="hidden" value={filter} />
            <button className="button button-secondary" type="submit">
              <CheckCircle2 size={17} />
              Mark read
            </button>
          </form>
        ) : null}
      </div>
    </article>
  );
}

export default async function AccountNotificationsPage({ searchParams }: NotificationsPageProps) {
  const user = await requireUser();
  const params = searchParams ? await searchParams : {};
  const filter = getFilter(getParam(params.filter));
  const [notifications, unreadCount, totalCount] = await Promise.all([
    getUserNotifications(user.id, filter),
    getUnreadNotificationCount(user.id),
    getNotificationCount(user.id),
  ]);
  const statusMessage = getStatusMessage(getParam(params.status));

  return (
    <main className="provider-shell account-shell">
      <header className="provider-topbar">
        <Link className="brand provider-brand" href="/">
          <Home size={30} strokeWidth={1.6} />
          Golden Home Care
        </Link>
        <nav className="provider-nav" aria-label="Account notification navigation">
          <Link href="/account">Account</Link>
          <Link href="/account/requests">My requests</Link>
          <Link className="notification-nav-link" href="/account/notifications">
            Notifications
            {unreadCount ? <span>{unreadCount}</span> : null}
          </Link>
          <Link href="/providers">Find providers</Link>
          <Link href="/provider">Provider dashboard</Link>
        </nav>
      </header>

      <section className="provider-page-heading">
        <h1>Notifications</h1>
        <p>Request updates and provider responses.</p>
      </section>

      {statusMessage ? (
        <p className={statusMessage.className} role={statusMessage.role}>
          {statusMessage.copy}
        </p>
      ) : null}

      <div className="notification-toolbar">
        <nav className="provider-inbox-tabs" aria-label="Notification filters">
          <a
            aria-current={filter === "unread" ? "page" : undefined}
            className={filter === "unread" ? "active" : undefined}
            href="/account/notifications?filter=unread"
          >
            Unread
            <span>{unreadCount}</span>
          </a>
          <a
            aria-current={filter === "all" ? "page" : undefined}
            className={filter === "all" ? "active" : undefined}
            href="/account/notifications?filter=all"
          >
            All
            <span>{totalCount}</span>
          </a>
        </nav>
        {unreadCount ? (
          <form action={markAllNotificationsRead}>
            <input name="filter" type="hidden" value={filter} />
            <button className="button button-outline" type="submit">
              <CheckCircle2 size={17} />
              Mark all read
            </button>
          </form>
        ) : null}
      </div>

      {notifications.length ? (
        <section className="notification-list" aria-label={`${filter} notifications`}>
          {notifications.map((notification) => (
            <NotificationCard filter={filter} key={notification.id} notification={notification} />
          ))}
        </section>
      ) : (
        <section className="provider-empty-state">
          <h2>No {filter} notifications</h2>
          <p>Request updates will appear here.</p>
        </section>
      )}
    </main>
  );
}
