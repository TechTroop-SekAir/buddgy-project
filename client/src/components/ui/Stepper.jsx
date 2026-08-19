import { Stepper as MantineStepper } from '@mantine/core';

// See components/ui/Tabs.jsx for the same compound-component pattern.
export function Stepper(props) {
  return <MantineStepper {...props} />;
}

Stepper.Step = MantineStepper.Step;
