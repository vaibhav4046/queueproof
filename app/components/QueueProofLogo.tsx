import type { SVGProps } from "react";

/**
 * QueueProof brand mark: a glowing evidence core inside two orbit rings, with the
 * proof check at its centre. The same three rings + one check path are used verbatim
 * in public/favicon.svg, public/queueproof-favicon-v2.svg and
 * public/queueproof-app-icon-v2.svg so every surface renders the identical mark.
 * tests/design-system.test.ts pins the check path across all four files.
 */
export function QueueProofSymbol({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      className={className}
      viewBox="0 0 36 36"
      fill="none"
      aria-hidden="true"
      shapeRendering="geometricPrecision"
      {...props}
    >
      <circle cx="18" cy="18" r="15.05" stroke="var(--ember, #ff6a00)" strokeOpacity=".34" strokeWidth="1.25" />
      <circle cx="18" cy="18" r="12.2" stroke="var(--ember, #ff6a00)" strokeOpacity=".2" strokeWidth="1" />
      <circle cx="18" cy="18" r="9.2" fill="var(--ember, #ff6a00)" />
      <path
        d="M13.75 18.3 16.8 21.35 22.45 14.95"
        stroke="#FAF7F2"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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
      <g>
        <QueueProofSymbol width="36" height="36" />
      </g>
      <text
        x="45.5"
        y="24.6"
        fontFamily="var(--font-geist-sans), Geist, sans-serif"
        fontSize="16.4"
        fontWeight="760"
        letterSpacing="-.15"
      >
        <tspan fill="currentColor">QUEUE</tspan>
        <tspan fill="var(--ember, #ff6a00)">PROOF</tspan>
      </text>
    </svg>
  );
}
