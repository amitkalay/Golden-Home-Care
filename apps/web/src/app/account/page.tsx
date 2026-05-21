import Image from "next/image";
import Link from "next/link";
import { Camera, Home, Trash2 } from "lucide-react";
import { requireUser } from "../lib/auth";
import { getUserAccount } from "./db";
import { saveAccountProfile } from "./actions";
import { SignOutButton } from "../sign-out-button";
import { getUnreadNotificationCount } from "../notifications/db";

export const dynamic = "force-dynamic";

type AccountPageProps = {
  searchParams?: Promise<{
    status?: string | string[];
  }>;
};

function getStatusMessage(status?: string) {
  if (status === "saved") {
    return {
      className: "form-alert success full",
      copy: "Your account profile has been saved.",
      role: "status",
    };
  }

  if (status === "invalid") {
    return {
      className: "form-alert error full",
      copy: "Please enter your name and keep the profile fields within the allowed length.",
      role: "alert",
    };
  }

  if (status === "error") {
    return {
      className: "form-alert error full",
      copy: "We could not save your account profile. Check your environment configuration and try again.",
      role: "alert",
    };
  }

  return null;
}

export default async function AccountPage({ searchParams }: AccountPageProps) {
  const user = await requireUser();
  const [account, unreadNotificationCount] = await Promise.all([
    getUserAccount(user.id),
    getUnreadNotificationCount(user.id),
  ]);
  const params = searchParams ? await searchParams : {};
  const status = Array.isArray(params.status) ? params.status[0] : params.status;
  const statusMessage = getStatusMessage(status);
  const displayName = account?.name || user.name || "";

  return (
    <main className="provider-shell account-shell">
      <header className="provider-topbar">
        <Link className="brand provider-brand" href="/">
          <Home size={30} strokeWidth={1.6} />
          Golden Home Care
        </Link>
        <nav className="provider-nav" aria-label="Account navigation">
          <Link className="notification-nav-link" href="/account/notifications">
            Notifications
            {unreadNotificationCount ? <span>{unreadNotificationCount}</span> : null}
          </Link>
          <Link href="/account/requests">My requests</Link>
          <Link href="/providers">Find providers</Link>
          <Link href="/provider/onboarding">Become a provider</Link>
          <Link href="/provider">Provider dashboard</Link>
          <SignOutButton className="nav-link-button" />
        </nav>
      </header>

      <section className="provider-page-heading">
        <h1>Account profile</h1>
        <p>Manage the personal profile shown when you are signed in.</p>
      </section>

      <form className="form-card provider-profile-form account-profile-form" action={saveAccountProfile}>
        {statusMessage ? (
          <p className={statusMessage.className} role={statusMessage.role}>
            {statusMessage.copy}
          </p>
        ) : null}
        <div className="account-photo-panel full">
          <div className="account-photo">
            {account?.image ? (
              <Image src={account.image} alt="" fill sizes="96px" />
            ) : (
              <span>{displayName.slice(0, 1) || "G"}</span>
            )}
          </div>
          <label>
            <Camera size={18} />
            Profile photo
            <input name="photo" type="file" accept="image/jpeg,image/png,image/webp" />
          </label>
        </div>
        <label>
          Name
          <input
            name="name"
            type="text"
            placeholder="Your name"
            defaultValue={displayName}
            autoComplete="name"
            required
          />
        </label>
        <label>
          Email
          <input type="email" value={account?.email ?? user.email ?? ""} disabled />
        </label>
        <label className="full">
          Bio
          <textarea
            name="bio"
            placeholder="Share a short note about yourself."
            rows={5}
            defaultValue={account?.bio ?? ""}
          />
        </label>
        <button className="button button-primary form-button full" type="submit">
          Save account profile
        </button>
      </form>

      <section className="account-danger-zone">
        <div>
          <h2>Delete account</h2>
          <p>This permanently removes your account and any provider listing tied to it.</p>
        </div>
        <Link className="button button-outline danger-button" href="/account/delete">
          <Trash2 size={17} />
          Delete account
        </Link>
      </section>
    </main>
  );
}
