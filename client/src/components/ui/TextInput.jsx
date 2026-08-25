import { forwardRef } from 'react';
import { TextInput as MantineTextInput } from '@mantine/core';

// See components/ui/Button.jsx for why this indirection exists.
//
// forwardRef matters here: PromptBar.jsx holds a ref to this input for focus
// management (refocusing after a submit). Without forwarding, that ref is
// null and React warns "Function components cannot be given refs."
export const TextInput = forwardRef(function TextInput(props, ref) {
  return <MantineTextInput ref={ref} {...props} />;
});
