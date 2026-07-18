import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { DurationInputStorybookComponent } from './duration-input-storybook.component';

export default {
  title: 'Components/Forms/Duration Input',
  component: DurationInputStorybookComponent,
  decorators: [moduleMetadata({ imports: [DurationInputStorybookComponent] })],
  argTypes: {
    label: { control: 'text' },
    hint: { control: 'text' },
    placeholder: { control: 'text' },
    durationFormat: { control: 'text' },
    value: { control: 'number' },
    disabled: { control: 'boolean' },
    required: { control: 'boolean' },
    color: { control: 'select', options: ['brand', 'danger', 'success', 'warning', 'neutral'] },
  },
  args: {
    label: 'Lap time',
    hint: 'Type 130 for 1:30',
    placeholder: 'mm:ss',
    durationFormat: 'mm:ss',
    value: null,
    disabled: false,
    required: false,
    color: 'brand',
  },
} as Meta<DurationInputStorybookComponent>;

type Story = StoryObj<DurationInputStorybookComponent>;

export const Default: Story = {};

export const HoursMinutesSeconds: Story = {
  args: { label: 'Race duration', durationFormat: 'hh:mm:ss', placeholder: 'hh:mm:ss', hint: '' },
};

export const WithMilliseconds: Story = {
  args: { label: 'Split time', durationFormat: 'mm:ss.SSS', placeholder: 'mm:ss.SSS', hint: '' },
};
