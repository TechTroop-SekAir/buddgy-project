import { forwardRef } from 'react';
import { Button as MantineButton } from '@mantine/core';

// Thin adapter — feature code imports Button from here, never from
// '@mantine/core' directly. See CLAUDE.md § Stack and docs/DESIGN.md
// § Component Library Boundary: this indirection is what makes the
// component library swappable later.
//
// forwardRef matters here: Menu.Target/Tooltip/Popover clone their child and
// attach a ref to it as the Floating-UI positioning anchor. Without
// forwarding, that ref is null and the portalled dropdown falls back to
// top:0/left:0 instead of anchoring to this button.
export const Button = forwardRef(function Button(props, ref) {
  return <MantineButton ref={ref} {...props} />;
});
