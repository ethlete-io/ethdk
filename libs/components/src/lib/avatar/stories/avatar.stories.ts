import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { AvatarStorybookComponent } from './avatar-storybook.component';

export default {
  title: 'Components/Avatar',
  component: AvatarStorybookComponent,
  decorators: [moduleMetadata({ imports: [AvatarStorybookComponent] })],
  args: { size: 'md', shape: 'circle' },
  argTypes: {
    size: { control: 'select', options: ['xs', 'sm', 'md', 'lg', 'xl'] },
    shape: { control: 'select', options: ['circle', 'square'] },
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
