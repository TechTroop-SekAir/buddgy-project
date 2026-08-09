import { Modal as MantineModal } from '@mantine/core';

// See components/ui/Button.jsx for why this indirection exists.
export function Modal(props) {
  return <MantineModal {...props} />;
}
