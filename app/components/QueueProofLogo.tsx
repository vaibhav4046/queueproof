import type { SVGProps } from "react";

export function QueueProofSymbol({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg className={className} viewBox="0 0 36 36" fill="none" aria-hidden="true" {...props}>
      <path d="M25.8 25.2A10.8 10.8 0 1 1 28.8 18c0 2.8-1 5.3-2.7 7.2l4.3 4.1" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m12.9 18.2 3.3 3.3 7-7.5" stroke="var(--ember, #ff6a00)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function QueueProofLogo({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      className={className}
      viewBox="0 0 166 36"
      fill="none"
      role="img"
      aria-label="QueueProof"
      shapeRendering="geometricPrecision"
      textRendering="geometricPrecision"
      {...props}
    >
      <g><QueueProofSymbol width="36" height="36" /></g>
      <text
        x="46"
        y="24.25"
        fill="currentColor"
        fontFamily="var(--font-geist-sans), Geist, sans-serif"
        fontSize="18"
        fontWeight="670"
        letterSpacing="-.68"
      >QueueProof</text>
    </svg>
  );
}
