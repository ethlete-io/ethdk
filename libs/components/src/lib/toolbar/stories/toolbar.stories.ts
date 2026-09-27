import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { ToolbarNestedStorybookComponent } from './toolbar-nested-storybook.component';
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

export const Nested: StoryObj<ToolbarNestedStorybookComponent> = {
  decorators: [moduleMetadata({ imports: [ToolbarNestedStorybookComponent] })],
  render: () => ({ template: '<et-sb-toolbar-nested />' }),
  parameters: {
    docs: {
      description: {
        story:
          'A toolbar inside a toolbar keeps its own controls: the outer arrow keys skip over it, and it is a ' +
          'second tab stop that Tab moves into and out of.',
      },
    },
  },
};
