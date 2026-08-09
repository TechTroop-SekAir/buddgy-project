import { Card as MantineCard } from '@mantine/core';

// See components/ui/Button.jsx for why this indirection exists.
export function Card(props) {
  return <MantineCard {...props} />;
}
