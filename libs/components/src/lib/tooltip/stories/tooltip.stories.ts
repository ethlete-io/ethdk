import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { TooltipStorybookComponent } from './components';

export default {
  title: 'Components/Tooltip',
  component: TooltipStorybookComponent,
  decorators: [moduleMetadata({ imports: [TooltipStorybookComponent] })],
  args: {
    placement: 'top',
    disabled: false,
    tooltipText: 'A lightweight tooltip built on the new overlay primitives.',
    templateTooltipAriaDescription:
      'Tooltip. Templated content works too, so richer help and compact metadata are possible.',
  },
  argTypes: {
    placement: { control: 'radio', options: ['top', 'right', 'bottom', 'left'] },
    disabled: { control: 'boolean' },
    tooltipText: { control: 'text' },
    templateTooltipAriaDescription: { control: 'text' },
  },
} as Meta<TooltipStorybookComponent>;

type Story = StoryObj<TooltipStorybookComponent>;

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
