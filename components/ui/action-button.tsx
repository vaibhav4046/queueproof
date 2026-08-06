"use client";

import { LoaderCircle } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ActionButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  label: string;
  icon?: ReactNode;
  loading?: boolean;
};

/** A native primary action with a static QueueProof surface and honest loading state. */
export function ActionButton({
  label,
  icon,
  loading = false,
  disabled = false,
  type = "button",
  className,
  ...buttonProps
}: ActionButtonProps) {
  const classes = ["primary-button", "action-button", className ?? ""]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      {...buttonProps}
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {loading ? <LoaderCircle className="spin" size={15} aria-hidden="true" /> : icon}
      <span>{label}</span>
    </button>
  );
}
