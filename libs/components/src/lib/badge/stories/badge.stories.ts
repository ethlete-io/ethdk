import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { BadgeStorybookComponent } from './badge-storybook.component';

export default {
  title: 'Components/Badge',
  component: BadgeStorybookComponent,
  decorators: [moduleMetadata({ imports: [BadgeStorybookComponent] })],
  args: { variant: 'tonal', size: 'md', iconAlignment: 'start' },
  argTypes: {
    variant: { control: 'select', options: ['filled', 'tonal', 'outline'] },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
    iconAlignment: { control: 'select', options: ['start', 'end'] },
  },
} as Meta<BadgeStorybookComponent>;

type Story = StoryObj<BadgeStorybookComponent>;

export const Default: Story = {};

export const Filled: Story = {
  args: { variant: 'filled' },
};

export const Outline: Story = {
  args: { variant: 'outline' },
};

export const Large: Story = {
  args: { size: 'lg' },
};

export const TrailingIcon: Story = {
  args: { iconAlignment: 'end' },
};
