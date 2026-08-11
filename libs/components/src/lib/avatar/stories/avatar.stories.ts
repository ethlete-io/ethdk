import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { AvatarStorybookComponent } from './avatar-storybook.component';

export default {
  title: 'Components/Avatar',
  component: AvatarStorybookComponent,
  decorators: [moduleMetadata({ imports: [AvatarStorybookComponent] })],
  args: { size: 'md', shape: 'circle', maxVisible: 3 },
  argTypes: {
    size: { control: 'select', options: ['xs', 'sm', 'md', 'lg', 'xl'] },
    shape: { control: 'select', options: ['circle', 'square'] },
    maxVisible: { control: { type: 'number', min: 1, max: 5 } },
  },
} as Meta<AvatarStorybookComponent>;

type Story = StoryObj<AvatarStorybookComponent>;

export const Default: Story = {};

export const Square: Story = {
  args: { shape: 'square' },
};

export const Large: Story = {
  args: { size: 'lg' },
};

/** Without `maxVisible` every projected avatar is shown and no `+N` is appended. */
export const AllAvatarsShown: Story = {
  args: { maxVisible: undefined },
};
