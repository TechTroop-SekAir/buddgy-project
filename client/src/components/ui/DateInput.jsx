// Native <input type="date"> — no Mantine date-picker dependency (kept out of
// scope, see A-07). Still lives behind the ui/ boundary per CLAUDE.md.
export function DateInput(props) {
  return <input type="date" {...props} />;
}
