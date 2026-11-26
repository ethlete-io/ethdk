import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { DividerStorybookComponent } from './divider-storybook.component';

export default {
  title: 'Components/Layout/Divider',
  component: DividerStorybookComponent,
  decorators: [moduleMetadata({ imports: [DividerStorybookComponent] })],
  args: { orientation: 'horizontal', decorative: false },
  argTypes: {
    orientation: { control: 'inline-radio', options: ['horizontal', 'vertical'] },
    decorative: { description: 'Screen readers only: drops the separator role, no visual change.' },
  },
} as Meta<DividerStorybookComponent>;

type Story = StoryObj<DividerStorybookComponent>;

export const Default: Story = {};

export const Vertical: Story = {
  args: { orientation: 'vertical' },
  parameters: {
    docs: {
      description: {
        story:
          'A vertical divider sizes itself from its parent’s cross axis, so it needs a flex or grid parent (or an explicit `block-size`).',
      },
    },
  },
};
