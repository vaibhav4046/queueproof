import type { SVGProps } from "react";

export function QueueProofSymbol({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" aria-hidden="true" {...props}>
      <path d="M23.1 22.4c-2.1 2-4.9 3.1-8 3.1C8.9 25.5 4 20.8 4 15S8.9 4.5 15.1 4.5 26.2 9.2 26.2 15c0 2.5-.9 4.8-2.5 6.6l4.3 4.1" stroke="currentColor" strokeWidth="2.15" strokeLinecap="round"/>
      <path d="m21.5 23.1 2.3 2.2 4.2-4.6" stroke="currentColor" strokeWidth="2.15" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M10.1 11.2 15 8.4l5 2.8v5.6l-5 2.8-4.9-2.8v-5.6Z" stroke="currentColor" strokeWidth="1.35" opacity=".72"/>
      <circle cx="15" cy="8.4" r="1.65" fill="currentColor"/>
      <circle cx="10.1" cy="16.8" r="1.65" fill="currentColor"/>
      <circle cx="20" cy="16.8" r="1.65" fill="currentColor"/>
    </svg>
  );
}

export function QueueProofLogo({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg className={className} viewBox="0 0 174 32" fill="none" role="img" aria-label="QueueProof" {...props}>
      <g transform="translate(0 0)"><QueueProofSymbol width="32" height="32" /></g>
      <text x="42" y="21.5" fill="currentColor" fontFamily="var(--font-geist-sans), Geist, sans-serif" fontSize="16" fontWeight="680" letterSpacing="-.35">QueueProof</text>
      <circle cx="132.5" cy="17" r="2" fill="var(--evidence, #5EE6A8)"/>
      <text x="140" y="20.8" fill="currentColor" opacity=".56" fontFamily="var(--font-geist-mono), monospace" fontSize="8" fontWeight="560">LIVE</text>
    </svg>
  );
}
