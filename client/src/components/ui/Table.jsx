import { Table as MantineTable } from '@mantine/core';

// See components/ui/Button.jsx for why this indirection exists.
export function Table(props) {
  return <MantineTable {...props} />;
}

Table.Thead = MantineTable.Thead;
Table.Tbody = MantineTable.Tbody;
Table.Tr = MantineTable.Tr;
Table.Th = MantineTable.Th;
Table.Td = MantineTable.Td;
