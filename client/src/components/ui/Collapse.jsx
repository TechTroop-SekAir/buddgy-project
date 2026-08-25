import { Collapse as MantineCollapse } from '@mantine/core';

// Thin adapter — feature code imports Collapse from here, never from
// '@mantine/core' directly. See CLAUDE.md § Stack and docs/DESIGN.md
// § Component Library Boundary: this indirection is what makes the
// component library swappable later.
export function Collapse(props) {
  return <MantineCollapse {...props} />;
}
