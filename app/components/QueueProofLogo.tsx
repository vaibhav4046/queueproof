import type { SVGProps } from "react";

export function QueueProofSymbol({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg className={className} viewBox="0 0 36 36" fill="none" aria-hidden="true" {...props}>
      <circle cx="18" cy="18" r="15" stroke="currentColor" strokeWidth="1.6" opacity=".48" />
      <path d="M24.6 23.9A9.5 9.5 0 1 1 27.5 17c0 2.4-.9 4.6-2.4 6.3l4 3.8" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="18" cy="17" r="4.2" fill="var(--ember, #ff6a00)" />
      <circle cx="10.3" cy="9.7" r="1.35" fill="var(--ember-bright, #ff9a42)" />
      <circle cx="27.1" cy="12.1" r="1.05" fill="var(--ember-soft, #ffd1aa)" opacity=".72" />
    </svg>
  );
}

export function QueueProofLogo({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg className={className} viewBox="0 0 166 36" fill="none" role="img" aria-label="QueueProof" {...props}>
      <g transform="translate(0 0)"><QueueProofSymbol width="36" height="36" /></g>
      <text x="47" y="24" fill="currentColor" fontFamily="var(--font-geist-sans), Geist, sans-serif" fontSize="18" fontWeight="680" letterSpacing="-.65">QueueProof</text>
    </svg>
  );
}
