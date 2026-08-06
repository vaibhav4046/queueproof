import styles from "./ember-backdrop.module.css";

export type EmberState =
  | "idle"
  | "retrieving"
  | "connecting"
  | "verifying"
  | "conflict"
  | "complete"
  | "error";

export type EmberPlacement = "composer" | "empty" | "connect" | "detail" | "demo";

export type EmberBackdropProps = {
  className?: string;
  decorative?: boolean;
  label?: string;
  placement?: EmberPlacement;
  state?: EmberState;
};

/** A local, static evidence texture. It performs no network or media work. */
export function EmberBackdrop({
  className,
  decorative = true,
  label = "Ember evidence field",
  placement = "composer",
  state = "idle",
}: EmberBackdropProps) {
  return (
    <div
      className={[styles.root, className].filter(Boolean).join(" ")}
      data-ember-backdrop=""
      data-placement={placement}
      data-state={state}
      aria-hidden={decorative ? "true" : undefined}
      aria-label={decorative ? undefined : label}
      role={decorative ? undefined : "img"}
    >
      <span className={styles.fallback} aria-hidden="true" />
    </div>
  );
}
