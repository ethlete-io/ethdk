import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { SkeletonStorybookComponent } from './skeleton-storybook.component';

export default {
  title: 'Components/Skeleton',
  component: SkeletonStorybookComponent,
  decorators: [moduleMetadata({ imports: [SkeletonStorybookComponent] })],
  args: { animated: true, surface: 'dark' },
  argTypes: { animated: { control: 'boolean' }, surface: { control: 'text' } },
} as Meta<SkeletonStorybookComponent>;

type Story = StoryObj<SkeletonStorybookComponent>;

export const Default: Story = {};

export const Static: Story = {
  args: { animated: false },
  parameters: {
    docs: {
      description: {
        story:
          '`animated="false"` leaves the same shapes without the shimmer — for a placeholder inside ' +
          'something that already moves, or a very long list where a sweep per row is noise. The shimmer ' +
          'is dropped automatically under `prefers-reduced-motion` regardless.',
      },
    },
  },
};
