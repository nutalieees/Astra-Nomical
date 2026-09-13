interface EnterWorldTransitionProps {
  planetName: string;
}

export function EnterWorldTransition({ planetName }: EnterWorldTransitionProps) {
  return (
    <div className="enter-transition" role="status" aria-live="polite">
      <div className="warp-lines" aria-hidden="true" />
      <div>
        <span className="eyebrow">NAVIGATION LOCKED</span>
        <strong>Descending into {planetName}</strong>
      </div>
    </div>
  );
}
