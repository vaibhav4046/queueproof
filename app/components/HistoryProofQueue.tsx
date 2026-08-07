import { ArrowUpRight, Network, ReceiptText, Route } from "lucide-react";
import Link from "next/link";
import { dateLabel } from "../date-label";

export type HistoryProofItem = {
  id: string;
  question: string;
  createdAt: string;
  status: "grounded" | "partial" | "abstained";
  providers: string[];
};

export type HistoryProofQueueProps = {
  investigations: HistoryProofItem[];
};

type ProviderUsage = {
  name: string;
  receipts: number;
};

const MAX_VISIBLE_RECEIPTS = 4;

function providerUsage(investigations: HistoryProofItem[]): ProviderUsage[] {
  const usage = new Map<string, number>();

  for (const investigation of investigations) {
    for (const provider of new Set(investigation.providers.map((item) => item.trim()).filter(Boolean))) {
      usage.set(provider, (usage.get(provider) ?? 0) + 1);
    }
  }

  return [...usage.entries()]
    .map(([name, receipts]) => ({ name, receipts }))
    .sort((left, right) => right.receipts - left.receipts || left.name.localeCompare(right.name));
}

function providerInitials(provider: string): string {
  return provider
    .split(/[\s_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "S";
}

/**
 * A compact history map built only from the receipt IDs and source labels saved
 * after real investigations. It deliberately avoids decorative placeholder
 * nodes: an empty workspace renders an empty path.
 */
export function HistoryProofQueue({ investigations }: HistoryProofQueueProps) {
  const providers = providerUsage(investigations);
  const sourceLinks = providers.reduce((total, provider) => total + provider.receipts, 0);
  const maxUsage = providers[0]?.receipts ?? 1;
  const visibleInvestigations = investigations.slice(0, MAX_VISIBLE_RECEIPTS);

  return (
    <section className="history-proof-queue" aria-labelledby="history-proof-queue-title">
      <header className="history-proof-queue-head">
        <div>
          <span className="history-proof-kicker"><Network size={13} aria-hidden="true" /> Receipt paths</span>
          <h2 id="history-proof-queue-title">Your evidence, arranged as a queue.</h2>
          <p>Every path comes from a source label stored with a saved investigation receipt.</p>
        </div>
        <dl className="history-proof-totals" aria-label="Saved receipt path totals">
          <div><dt>Receipts</dt><dd>{investigations.length}</dd></div>
          <div><dt>Sources</dt><dd>{providers.length}</dd></div>
          <div><dt>Links</dt><dd>{sourceLinks}</dd></div>
        </dl>
      </header>

      {!investigations.length ? (
        <div className="history-proof-empty">
          <Route size={22} aria-hidden="true" />
          <div>
            <strong>Your first receipt will start the path.</strong>
            <p>No source nodes are shown until QueueProof stores a real investigation.</p>
          </div>
        </div>
      ) : (
        <div className="history-proof-map">
          <aside className="history-source-usage" aria-label="Sources recorded in saved receipts">
            <div className="history-map-label">
              <span>Source use</span>
              <small>{sourceLinks} recorded link{sourceLinks === 1 ? "" : "s"}</small>
            </div>
            {providers.length ? (
              <ol>
                {providers.map((provider) => (
                  <li key={provider.name}>
                    <span className="history-source-mark" aria-hidden="true">{providerInitials(provider.name)}</span>
                    <span className="history-source-copy">
                      <strong>{provider.name}</strong>
                      <small>{provider.receipts} saved question{provider.receipts === 1 ? "" : "s"}</small>
                    </span>
                    <span className="history-source-meter" aria-hidden="true">
                      <i style={{ width: `${(provider.receipts / maxUsage) * 100}%` }} />
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="history-no-source-links">These receipts stored no source coverage.</p>
            )}
          </aside>

          <div className="history-receipt-lane">
            <div className="history-map-label">
              <span>Latest receipts</span>
              <small>
                {investigations.length > MAX_VISIBLE_RECEIPTS
                  ? `${MAX_VISIBLE_RECEIPTS} of ${investigations.length}`
                  : investigations.length}
              </small>
            </div>
            <ol className="history-receipt-spine">
              {visibleInvestigations.map((investigation, index) => {
                const uniqueProviders = [...new Set(investigation.providers.filter(Boolean))];
                return (
                  <li key={investigation.id}>
                    <span className="history-receipt-node" aria-hidden="true">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <Link href={`/?run=${encodeURIComponent(investigation.id)}`}>
                      <span className="history-receipt-copy">
                        <strong>{investigation.question}</strong>
                        <small><ReceiptText size={12} aria-hidden="true" /> <code>{investigation.id}</code> · {dateLabel(investigation.createdAt)}</small>
                      </span>
                      <span className={`history-status ${investigation.status}`}>{investigation.status}</span>
                      <span className="history-receipt-sources" aria-label={`Sources: ${uniqueProviders.join(", ") || "none recorded"}`}>
                        {uniqueProviders.slice(0, 3).map((provider) => <span key={provider}>{provider}</span>)}
                        {uniqueProviders.length > 3 ? <span>+{uniqueProviders.length - 3}</span> : null}
                        {!uniqueProviders.length ? <em>No source coverage</em> : null}
                      </span>
                      <ArrowUpRight className="history-receipt-open" size={14} aria-hidden="true" />
                    </Link>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      )}
    </section>
  );
}
