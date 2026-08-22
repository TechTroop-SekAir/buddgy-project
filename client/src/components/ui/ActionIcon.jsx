import { forwardRef } from 'react';
import { ActionIcon as MantineActionIcon } from '@mantine/core';

// See components/ui/Button.jsx for why this indirection exists.
// forwardRef matters here: Menu.Target/Tooltip/Popover clone their child and
// attach a ref to it as the Floating-UI positioning anchor. Without
// forwarding, that ref is null and the portalled dropdown falls back to
// top:0/left:0 instead of anchoring to this icon.
export const ActionIcon = forwardRef(function ActionIcon(props, ref) {
  return <MantineActionIcon ref={ref} {...props} />;
});
