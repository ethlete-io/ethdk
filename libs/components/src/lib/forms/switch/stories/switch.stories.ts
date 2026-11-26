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
    variant: { control: 'radio', options: ['plain', 'card'] },
  },
  args: {
    size: 'md',
    readonly: false,
    variant: 'plain',
  },
} as Meta<FormFieldSwitchStorybookComponent>;

type Story = StoryObj<FormFieldSwitchStorybookComponent>;

export const Default: Story = {};

export const Readonly: Story = {
  args: { readonly: true },
};

export const Card: Story = {
  args: { variant: 'card' },
  parameters: {
    docs: {
      description: {
        story:
          'The card preset lives on `et-choice-field`, so the switch gets it from the same place the checkbox ' +
          'does - the whole panel is the target and the selection shows on its border.',
      },
    },
  },
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
