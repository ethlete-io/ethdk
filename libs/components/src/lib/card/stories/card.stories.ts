import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { CardStorybookComponent } from './card-storybook.component';

export default {
  title: 'Components/Card',
  component: CardStorybookComponent,
  decorators: [moduleMetadata({ imports: [CardStorybookComponent] })],
  args: { variant: 'outlined' },
  argTypes: { variant: { control: 'select', options: ['elevated', 'outlined', 'filled'] } },
} as Meta<CardStorybookComponent>;

type Story = StoryObj<CardStorybookComponent>;

export const Default: Story = {};

export const Elevated: Story = {
  args: { variant: 'elevated' },
};

export const Filled: Story = {
  args: { variant: 'filled' },
};
