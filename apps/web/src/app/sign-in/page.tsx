import { Home, LogIn } from "lucide-react";
import Link from "next/link";
import { signInWithGoogle } from "../provider/actions";

export default function SignInPage() {
  return (
    <main className="auth-shell">
      <Link className="brand auth-brand" href="/">
        <span className="brand-mark">
          <Home size={34} strokeWidth={1.6} />
        </span>
        <span>Golden Home Care</span>
      </Link>
      <section className="auth-card">
        <h1>Provider sign in</h1>
        <p>Sign in with Google to create and manage your Golden Home Care provider profile.</p>
        <form action={signInWithGoogle}>
          <button className="button button-primary auth-button" type="submit">
            <LogIn size={18} />
            Continue with Google
          </button>
        </form>
      </section>
    </main>
  );
}

