type EvidenceOrbProps = {
  state?: "idle" | "ready" | "searching" | "answered" | "partial";
};

export function EvidenceOrb({ state = "idle" }: EvidenceOrbProps) {
  return (
    <div className={`evidence-orb evidence-orb-${state}`} aria-hidden="true">
      <span className="orb-halo" />
      <span className="orb-shell orb-shell-one" />
      <span className="orb-shell orb-shell-two" />
      <span className="orb-shell orb-shell-three" />
      <span className="orb-core" />
      <span className="orb-signal orb-signal-one" />
      <span className="orb-signal orb-signal-two" />
      <span className="orb-signal orb-signal-three" />
    </div>
  );
}
