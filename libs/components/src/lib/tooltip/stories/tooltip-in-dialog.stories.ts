import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { TooltipInDialogStorybookComponent } from './components';

export default {
  title: 'Components/Feedback/Tooltip/In Dialog',
  component: TooltipInDialogStorybookComponent,
  decorators: [moduleMetadata({ imports: [TooltipInDialogStorybookComponent] })],
} as Meta<TooltipInDialogStorybookComponent>;

type Story = StoryObj<TooltipInDialogStorybookComponent>;

export const Default: Story = {};
