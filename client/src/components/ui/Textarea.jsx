import { Textarea as MantineTextarea } from '@mantine/core';

// See components/ui/Button.jsx for why this indirection exists.
export function Textarea(props) {
  return <MantineTextarea {...props} />;
}
