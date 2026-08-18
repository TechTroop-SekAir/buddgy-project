// Token-only progress bar — deliberately not a Mantine wrapper. Mantine's
// Progress clamps at 100 with no way to signal "over budget" beyond color;
// this owns that signal directly. See docs/DASHBOARD-REDESIGN.md Step 2.
const FILL_CLASSES = {
  'status-ok': 'bg-status-ok-fill',
  'status-warning': 'bg-status-warning-fill',
  'status-critical': 'bg-status-critical-fill',
  'status-danger': 'bg-status-danger-fill',
};

/**
 * <Meter percent={112} status="overBudget" color="status-danger" label="…" />
 *
 * `percent` is the true, unclamped ratio*100 — the fill width clamps at
 * 100% but the bar still signals overspend via a danger ring, so magnitude
 * isn't hidden from screen readers or from the numeric label callers render
 * alongside this.
 */
export function Meter({ percent = 0, color = 'status-ok', label, size = 'sm', className = '' }) {
  const clamped = Math.min(Math.max(percent, 0), 100);
  const overCap = percent > 100;
  const fillClass = FILL_CLASSES[color] ?? FILL_CLASSES['status-ok'];
  const heightClass = size === 'lg' ? 'h-2' : 'h-1.5';

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={`w-full overflow-hidden rounded-pill bg-bg-subtle ${heightClass} ${
        overCap ? 'ring-1 ring-inset ring-status-danger' : ''
      } ${className}`}
    >
      <div
        className={`h-full rounded-pill transition-[width] duration-slow ${fillClass}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
