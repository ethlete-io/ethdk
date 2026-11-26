import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { RatingStorybookComponent } from './rating-storybook.component';

export default {
  title: 'Components/Forms/Rating',
  component: RatingStorybookComponent,
  decorators: [moduleMetadata({ imports: [RatingStorybookComponent] })],
  argTypes: {
    label: { control: 'text' },
    hint: { control: 'text' },
    value: { control: 'number' },
    mixed: { control: 'boolean' },
    mixedLabel: { control: 'text' },
    showMixedState: { control: false, table: { disable: true } },
    max: { control: 'number' },
    allowHalf: { control: 'boolean' },
    disabled: { control: 'boolean' },
    readonly: { control: 'boolean' },
    required: { control: 'boolean' },
    color: { control: 'select', options: ['brand', 'danger', 'success', 'warning', 'neutral'] },
  },
  args: {
    label: 'Rating',
    hint: '',
    value: null,
    mixed: false,
    mixedLabel: 'Mixed',
    showMixedState: false,
    max: 5,
    allowHalf: false,
    disabled: false,
    readonly: false,
    required: false,
    color: 'brand',
  },
} as Meta<RatingStorybookComponent>;

type Story = StoryObj<RatingStorybookComponent>;

export const Default: Story = {};

export const HalfSteps: Story = {
  args: { allowHalf: true, value: 3.5 },
};

export const Mixed: Story = {
  args: {
    mixed: true,
    value: 3,
    mixedLabel: 'Different ratings',
    showMixedState: true,
    hint: 'The raw value stays intact until a user commits a pick; no star fills while mixed.',
  },
};

export const Readonly: Story = {
  args: { readonly: true, value: 4, hint: 'Averaged from 128 reviews' },
};
