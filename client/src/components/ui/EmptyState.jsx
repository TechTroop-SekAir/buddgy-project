// Centralizes the "centered message + optional CTA" markup every list page
// used to hand-roll independently — see client/CLAUDE.md's Async UX Contract
// ("every list renders a dedicated empty-state component").
// No default top margin — callers pass their own spacing (mt-16 for a
// full-page empty list, tighter for an inline empty state) via `className`.
export function EmptyState({ message, action, className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center text-center gap-4 ${className}`.trim()}>
      <p className="text-text-secondary">{message}</p>
      {action}
    </div>
  );
}
