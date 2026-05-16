import { ProviderShell } from "../ui";

export const dynamic = "force-dynamic";

export default function ProviderMessagesPage() {
  return (
    <ProviderShell title="Messages" copy="Family messages will appear here after messaging is enabled.">
      <section className="provider-empty-state">
        <h2>No messages yet</h2>
        <p>This placeholder keeps the provider dashboard navigation ready while booking and messaging are still being built.</p>
      </section>
    </ProviderShell>
  );
}

