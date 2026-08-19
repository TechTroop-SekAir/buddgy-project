import { Checkbox as MantineCheckbox } from '@mantine/core';

// See components/ui/Button.jsx for why this indirection exists.
export function Checkbox(props) {
  return <MantineCheckbox {...props} />;
}
