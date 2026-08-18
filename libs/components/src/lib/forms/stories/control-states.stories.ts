import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import {
  ControlStatesFocusStorybookComponent,
  ControlStatesStorybookComponent,
} from './control-states-storybook.component';

export default {
  title: 'Components/Forms/Control States',
  component: ControlStatesStorybookComponent,
  decorators: [moduleMetadata({ imports: [ControlStatesStorybookComponent] })],
  argTypes: {
    states: { control: 'check', options: ['default', 'readonly', 'disabled', 'mixed'] },
  },
  args: {
    states: ['default', 'readonly', 'disabled', 'mixed'],
  },
} as Meta<ControlStatesStorybookComponent>;

type Story = StoryObj<ControlStatesStorybookComponent>;

export const AllStates: Story = {};

export const Readonly: Story = {
  args: { states: ['readonly'] },
};

export const Disabled: Story = {
  args: { states: ['disabled'] },
};

export const Mixed: Story = {
  args: { states: ['mixed'] },
};

/**
 * Every control, stepped through one tab stop at a time. Only one element can hold real focus, so
 * the focus look is reviewed in sequence - and the walk follows DOM order, so it doubles as a check
 * of the tab order.
 */
export const FocusWalk: StoryObj<ControlStatesFocusStorybookComponent> = {
  render: () => ({
    template: '<et-sb-control-states-focus />',
    moduleMetadata: { imports: [ControlStatesFocusStorybookComponent] },
  }),
  argTypes: { states: { table: { disable: true } } },
};
