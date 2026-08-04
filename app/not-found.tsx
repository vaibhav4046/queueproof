import Link from "next/link";
import { Activity, ArrowRight, RotateCcw, Search } from "lucide-react";
import { QueueProofLogo } from "./components/QueueProofLogo";

export default function NotFound() {
  return <main className="not-found-page" id="main-content">
    <Link href="/" aria-label="QueueProof home"><QueueProofLogo /></Link>
    <section>
      <span>404 · No evidence at this address</span>
      <h1>This route left no receipt.</h1>
      <p>The product is working; this URL is not. Return to a verified QueueProof surface.</p>
      <nav aria-label="Continue in QueueProof">
        <Link href="/"><Search size={16} />Ask a question<ArrowRight size={14} /></Link>
        <Link href="/replay"><RotateCcw size={16} />Open Replay<ArrowRight size={14} /></Link>
        <Link href="/benchmarks"><Activity size={16} />See Benchmarks<ArrowRight size={14} /></Link>
      </nav>
    </section>
  </main>;
}
