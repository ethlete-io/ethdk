import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { FormFieldSwitchStorybookComponent, SwitchDisabledStorybookComponent } from './switch-storybook.component';

export default {
  title: 'Components/Forms/Switch',
  component: FormFieldSwitchStorybookComponent,
  decorators: [moduleMetadata({ imports: [FormFieldSwitchStorybookComponent] })],
} as Meta<FormFieldSwitchStorybookComponent>;

type Story = StoryObj<FormFieldSwitchStorybookComponent>;

export const Default: Story = {};

export const Disabled: StoryObj<SwitchDisabledStorybookComponent> = {
  render: () => ({
    moduleMetadata: { imports: [SwitchDisabledStorybookComponent] },
    template: '<et-sb-switch-disabled />',
  }),
};
