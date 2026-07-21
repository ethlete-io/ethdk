import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import {
  FormFieldSwitchStorybookComponent,
  SwitchDisabledStorybookComponent,
  SwitchIndeterminateStorybookComponent,
} from './switch-storybook.component';

export default {
  title: 'Components/Forms/Switch',
  component: FormFieldSwitchStorybookComponent,
  decorators: [moduleMetadata({ imports: [FormFieldSwitchStorybookComponent] })],
  argTypes: {
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
    readonly: { control: 'boolean' },
  },
  args: {
    size: 'md',
    readonly: false,
  },
} as Meta<FormFieldSwitchStorybookComponent>;

type Story = StoryObj<FormFieldSwitchStorybookComponent>;

export const Default: Story = {};

export const Readonly: Story = {
  args: { readonly: true },
};

export const Indeterminate: StoryObj<SwitchIndeterminateStorybookComponent> = {
  render: () => ({
    moduleMetadata: { imports: [SwitchIndeterminateStorybookComponent] },
    template: '<et-sb-switch-indeterminate />',
  }),
};

export const Disabled: StoryObj<SwitchDisabledStorybookComponent> = {
  render: () => ({
    moduleMetadata: { imports: [SwitchDisabledStorybookComponent] },
    template: '<et-sb-switch-disabled />',
  }),
};
