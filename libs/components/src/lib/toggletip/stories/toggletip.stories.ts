import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { ToggletipPinnedStorybookComponent, ToggletipStorybookComponent } from './components';

export default {
  title: 'Components/Feedback/Toggletip',
  component: ToggletipStorybookComponent,
  decorators: [moduleMetadata({ imports: [ToggletipStorybookComponent] })],
  args: {
    placement: 'top',
    disabled: false,
    toggletipText: 'A click-triggered toggletip for richer, interactive guidance.',
    templateToggletipAriaLabel: 'Matchday note',
  },
  argTypes: {
    placement: { control: 'radio', options: ['top', 'right', 'bottom', 'left'] },
    disabled: { control: 'boolean' },
    toggletipText: { control: 'text' },
    templateToggletipAriaLabel: { control: 'text' },
  },
} as Meta<ToggletipStorybookComponent>;

type Story = StoryObj<ToggletipStorybookComponent>;

export const Default: Story = {};

export const Right: Story = {
  args: {
    placement: 'right',
  },
};

export const Bottom: Story = {
  args: {
    placement: 'bottom',
  },
};

export const OpenOnLoad: StoryObj<ToggletipPinnedStorybookComponent> = {
  render: () => ({ template: '<et-sb-toggletip-pinned />' }),
  decorators: [moduleMetadata({ imports: [ToggletipPinnedStorybookComponent] })],
};
