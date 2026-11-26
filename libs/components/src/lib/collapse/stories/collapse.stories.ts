import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { CollapseStorybookComponent } from './collapse-storybook.component';

export default {
  title: 'Components/Layout/Collapse',
  component: CollapseStorybookComponent,
  decorators: [moduleMetadata({ imports: [CollapseStorybookComponent] })],
  args: { open: false },
  argTypes: {
    open: { description: 'Whether the story starts open. A region that starts open does not animate in.' },
  },
} as Meta<CollapseStorybookComponent>;

type Story = StoryObj<CollapseStorybookComponent>;

export const Default: Story = {};

export const StartsOpen: Story = {
  args: { open: true },
};
