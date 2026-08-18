import { Skeleton as MantineSkeleton } from '@mantine/core';

// See components/ui/Button.jsx for why this indirection exists.
export function Skeleton(props) {
  return <MantineSkeleton {...props} />;
}
