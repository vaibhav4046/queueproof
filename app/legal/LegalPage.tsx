import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ExternalLink, ShieldCheck } from "lucide-react";
import { QueueProofLogo } from "../components/QueueProofLogo";
import styles from "./legal.module.css";

type LegalSection = {
  title: string;
  body: ReactNode;
};

type LegalPageProps = {
  eyebrow: string;
  title: string;
  summary: string;
  sections: LegalSection[];
};

export function LegalPage({ eyebrow, title, summary, sections }: LegalPageProps) {
  return (
    <main className={styles.page} id="main-content">
      <header className={styles.header}>
        <Link href="/" className={styles.brand} aria-label="QueueProof home">
          <QueueProofLogo />
        </Link>
        <Link href="/" className={styles.back}>
          <ArrowLeft size={15} /> Back to QueueProof
        </Link>
      </header>

      <article className={styles.article}>
        <div className={styles.hero}>
          <span className={styles.eyebrow}>{eyebrow}</span>
          <h1>{title}</h1>
          <p>{summary}</p>
          <div className={styles.receipt}>
            <ShieldCheck size={16} />
            <span>Effective 7 August 2026 · QueueProof public release</span>
          </div>
        </div>

        <div className={styles.sections}>
          {sections.map((section, index) => {
            const headingId = "policy-section-" + index;
            return (
              <section key={section.title} aria-labelledby={headingId}>
                <span className={styles.index}>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <h2 id={headingId}>{section.title}</h2>
                  {section.body}
                </div>
              </section>
            );
          })}
        </div>
      </article>

      <footer className={styles.footer}>
        <nav aria-label="QueueProof policies">
          <Link href="/support">Support</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/developer">MCP setup <ArrowRight size={13} /></Link>
        </nav>
        <a href="https://github.com/vaibhav4046" target="_blank" rel="noreferrer">
          Publisher profile <ExternalLink size={12} />
        </a>
      </footer>
    </main>
  );
}
