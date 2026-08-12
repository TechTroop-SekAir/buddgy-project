import { Progress as MantineProgress } from '@mantine/core';

// See components/ui/Button.jsx for why this indirection exists.
export function Progress(props) {
  return <MantineProgress {...props} />;
}
