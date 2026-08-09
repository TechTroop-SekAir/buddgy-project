import { NumberInput as MantineNumberInput } from '@mantine/core';

// See components/ui/Button.jsx for why this indirection exists.
// Money inputs: this component works in shekels for display only — convert
// to/from agorot at the service boundary (src/utils/money.js), never here.
export function NumberInput(props) {
  return <MantineNumberInput {...props} />;
}
