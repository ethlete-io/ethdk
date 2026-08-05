import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { BadgeStorybookComponent } from './badge-storybook.component';

export default {
  title: 'Components/Badge',
  component: BadgeStorybookComponent,
  decorators: [moduleMetadata({ imports: [BadgeStorybookComponent] })],
  args: { variant: 'tonal' },
  argTypes: { variant: { control: 'select', options: ['filled', 'tonal', 'outline'] } },
} as Meta<BadgeStorybookComponent>;

type Story = StoryObj<BadgeStorybookComponent>;

export const Default: Story = {};

export const Filled: Story = {
  args: { variant: 'filled' },
};

export const Outline: Story = {
  args: { variant: 'outline' },
};
