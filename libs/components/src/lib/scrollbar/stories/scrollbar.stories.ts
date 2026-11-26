import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { ScrollbarAxesStorybookComponent } from './scrollbar-axes-storybook.component';
import { ScrollbarStorybookComponent } from './scrollbar-storybook.component';

export default {
  title: 'Components/Layout/Scrollbar',
  component: ScrollbarStorybookComponent,
  decorators: [moduleMetadata({ imports: [ScrollbarStorybookComponent, ScrollbarAxesStorybookComponent] })],
  argTypes: {
    orientation: {
      control: { type: 'select' },
      options: ['vertical', 'horizontal'],
    },
    autoHide: {
      control: { type: 'boolean' },
    },
    minThumbSize: {
      control: { type: 'number' },
    },
    disabled: {
      control: { type: 'boolean' },
    },
  },
} as Meta<ScrollbarStorybookComponent>;

type Story = StoryObj<ScrollbarStorybookComponent>;

export const Default: Story = {
  args: {
    orientation: 'vertical',
    autoHide: false,
    minThumbSize: 24,
    disabled: false,
  },
};

export const Horizontal: Story = {
  args: {
    ...Default.args,
    orientation: 'horizontal',
  },
};

export const AutoHide: Story = {
  args: {
    ...Default.args,
    autoHide: true,
  },
};

export const BothAxesAndRtl: StoryObj<ScrollbarAxesStorybookComponent> = {
  render: () => ({ template: `<et-sb-scrollbar-axes />` }),
};
