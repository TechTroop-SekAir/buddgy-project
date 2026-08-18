import { Menu as MantineMenu } from '@mantine/core';

// See components/ui/Button.jsx for why this indirection exists.
export function Menu(props) {
  return <MantineMenu {...props} />;
}

Menu.Target = MantineMenu.Target;
Menu.Dropdown = MantineMenu.Dropdown;
Menu.Item = MantineMenu.Item;
Menu.Label = MantineMenu.Label;
Menu.Divider = MantineMenu.Divider;
