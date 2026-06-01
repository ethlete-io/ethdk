import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { RadioGroupStorybookComponent } from './radio-group-storybook.component';

export default {
  title: 'Components/Forms/Selection List/Radio Group',
  component: RadioGroupStorybookComponent,
  decorators: [moduleMetadata({ imports: [RadioGroupStorybookComponent] })],
  argTypes: {
    label: { control: 'text' },
    hint: { control: 'text' },
    disabled: { control: 'boolean' },
    required: { control: 'boolean' },
    color: { control: 'select', options: ['brand', 'danger', 'success', 'warning', 'neutral'] },
  },
  args: {
    label: 'Favorite color',
    hint: '',
    disabled: false,
    required: false,
    color: 'brand',
  },
} as Meta<RadioGroupStorybookComponent>;

type Story = StoryObj<RadioGroupStorybookComponent>;

export const Default: Story = {};
