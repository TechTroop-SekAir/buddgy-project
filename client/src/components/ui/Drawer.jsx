import { Drawer as MantineDrawer } from '@mantine/core';

// Thin adapter — feature code imports Drawer from here, never from
// '@mantine/core' directly. See CLAUDE.md § Stack and docs/DESIGN.md
// § Component Library Boundary: this indirection is what makes the
// component library swappable later.
export function Drawer(props) {
  return <MantineDrawer {...props} />;
}
