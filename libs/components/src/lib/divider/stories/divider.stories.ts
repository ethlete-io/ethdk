import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { DividerStorybookComponent } from './divider-storybook.component';

export default {
  title: 'Components/Divider',
  component: DividerStorybookComponent,
  decorators: [moduleMetadata({ imports: [DividerStorybookComponent] })],
  args: { orientation: 'horizontal', decorative: false },
  argTypes: { orientation: { control: 'inline-radio', options: ['horizontal', 'vertical'] } },
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

export const Decorative: Story = {
  args: { decorative: true },
  parameters: {
    docs: {
      description: {
        story:
          '`decorative` drops the `separator` role, for rules whose grouping is already clear from the surrounding markup.',
      },
    },
  },
};
