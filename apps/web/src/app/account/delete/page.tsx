import Link from "next/link";
import { AlertTriangle, Home, Trash2 } from "lucide-react";
import { requireUser } from "../../lib/auth";
import { getUserAccount } from "../db";
import { deleteCurrentAccount } from "../actions";

export const dynamic = "force-dynamic";

type DeleteAccountPageProps = {
  searchParams?: Promise<{
    step?: string | string[];
    status?: string | string[];
  }>;
};

export default async function DeleteAccountPage({ searchParams }: DeleteAccountPageProps) {
  const user = await requireUser();
  const account = await getUserAccount(user.id);
  const params = searchParams ? await searchParams : {};
  const step = Array.isArray(params.step) ? params.step[0] : params.step;
  const status = Array.isArray(params.status) ? params.status[0] : params.status;
  const isConfirmStep = step === "confirm";

  return (
    <main className="provider-shell account-shell">
      <header className="provider-topbar">
        <Link className="brand provider-brand" href="/">
          <Home size={30} strokeWidth={1.6} />
          Golden Home Care
        </Link>
        <nav className="provider-nav" aria-label="Account navigation">
          <Link href="/account">Account</Link>
          <Link href="/providers">Find providers</Link>
        </nav>
      </header>

      <section className="provider-page-heading">
        <h1>Delete account</h1>
        <p>This is permanent and removes account data, OAuth links, sessions, and provider listings.</p>
      </section>

      <section className="form-card account-delete-card">
        <AlertTriangle size={32} />
        <h2>{isConfirmStep ? "Confirm deletion" : "Before you delete"}</h2>
        <p>
          Deleting {account?.email ?? "this account"} will remove your Golden Home Care account. Any provider profile
          connected to this account will be removed from public search.
        </p>

        {isConfirmStep ? (
          <form className="account-delete-form" action={deleteCurrentAccount}>
            {status === "invalid" ? (
              <p className="form-alert error" role="alert">
                Type DELETE exactly to confirm account deletion.
              </p>
            ) : null}
            {status === "error" ? (
              <p className="form-alert error" role="alert">
                We could not delete your account. Try again in a moment.
              </p>
            ) : null}
            <label>
              Type DELETE to confirm
              <input name="confirmation" type="text" autoComplete="off" required />
            </label>
            <div className="account-delete-actions">
              <Link className="button button-outline" href="/account">
                Keep account
              </Link>
              <button className="button button-primary danger-button" type="submit">
                <Trash2 size={17} />
                Permanently delete
              </button>
            </div>
          </form>
        ) : (
          <div className="account-delete-actions">
            <Link className="button button-outline" href="/account">
              Keep account
            </Link>
            <Link className="button button-primary danger-button" href="/account/delete?step=confirm">
              Continue
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
