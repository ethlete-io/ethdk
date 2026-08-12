import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { ToolbarStorybookComponent } from './toolbar-storybook.component';

export default {
  title: 'Components/Layout/Toolbar',
  component: ToolbarStorybookComponent,
  decorators: [moduleMetadata({ imports: [ToolbarStorybookComponent] })],
  args: { orientation: 'horizontal', disableItalic: false },
  argTypes: { orientation: { control: 'inline-radio', options: ['horizontal', 'vertical'] } },
} as Meta<ToolbarStorybookComponent>;

type Story = StoryObj<ToolbarStorybookComponent>;

export const Default: Story = {};

export const Vertical: Story = {
  args: { orientation: 'vertical' },
  parameters: {
    docs: {
      description: {
        story: '`orientation="vertical"` stacks the controls and swaps arrow navigation to the up/down keys.',
      },
    },
  },
};

export const DisabledControl: Story = {
  args: { disableItalic: true },
  parameters: {
    docs: {
      description: {
        story: 'Arrow navigation skips a disabled control - a disabled button cannot hold focus at all.',
      },
    },
  },
};
