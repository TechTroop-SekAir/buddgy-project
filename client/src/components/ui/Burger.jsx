import { Burger as MantineBurger } from '@mantine/core';

// Thin adapter — feature code imports Burger from here, never from
// '@mantine/core' directly. See CLAUDE.md § Stack and docs/DESIGN.md
// § Component Library Boundary: this indirection is what makes the
// component library swappable later.
export function Burger(props) {
  return <MantineBurger {...props} />;
}
