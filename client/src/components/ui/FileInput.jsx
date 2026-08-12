import { FileInput as MantineFileInput } from '@mantine/core';

// See components/ui/Button.jsx for why this indirection exists.
export function FileInput(props) {
  return <MantineFileInput {...props} />;
}
