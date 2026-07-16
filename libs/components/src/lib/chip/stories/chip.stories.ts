import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { ChipStorybookComponent } from './chip-storybook.component';

export default {
  title: 'Components/Chip',
  component: ChipStorybookComponent,
  decorators: [moduleMetadata({ imports: [ChipStorybookComponent] })],
  argTypes: {
    disabled: { control: 'boolean' },
    removable: { control: 'boolean' },
  },
  args: { disabled: false, removable: true },
} as Meta<ChipStorybookComponent>;

type Story = StoryObj<ChipStorybookComponent>;

export const Default: Story = {};

export const NotRemovable: Story = {
  args: { removable: false },
};

export const Disabled: Story = {
  args: { disabled: true },
};
