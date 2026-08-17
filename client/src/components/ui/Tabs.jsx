import { Tabs as MantineTabs } from '@mantine/core';

// See components/ui/Button.jsx for why this indirection exists.
export function Tabs(props) {
  return <MantineTabs {...props} />;
}

Tabs.List = MantineTabs.List;
Tabs.Tab = MantineTabs.Tab;
Tabs.Panel = MantineTabs.Panel;
