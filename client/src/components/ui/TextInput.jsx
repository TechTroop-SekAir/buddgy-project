import { TextInput as MantineTextInput } from '@mantine/core';

// See components/ui/Button.jsx for why this indirection exists.
export function TextInput(props) {
  return <MantineTextInput {...props} />;
}
