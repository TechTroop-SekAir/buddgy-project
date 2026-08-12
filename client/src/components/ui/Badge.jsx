import { Badge as MantineBadge } from '@mantine/core';

// See components/ui/Button.jsx for why this indirection exists.
export function Badge(props) {
  return <MantineBadge {...props} />;
}
