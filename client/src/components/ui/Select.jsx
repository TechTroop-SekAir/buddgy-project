import { Select as MantineSelect } from '@mantine/core';

// See components/ui/Button.jsx for why this indirection exists.
export function Select(props) {
  return <MantineSelect {...props} />;
}
