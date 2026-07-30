import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { SliderStorybookComponent } from './slider-storybook.component';

export default {
  title: 'Components/Forms/Slider',
  component: SliderStorybookComponent,
  decorators: [moduleMetadata({ imports: [SliderStorybookComponent] })],
  argTypes: {
    label: { control: 'text' },
    hint: { control: 'text' },
    value: { control: 'number' },
    mixed: { control: 'boolean' },
    mixedLabel: { control: 'text' },
    showMixedState: { control: false, table: { disable: true } },
    min: { control: 'number' },
    max: { control: 'number' },
    step: { control: 'number' },
    orientation: { control: 'inline-radio', options: ['horizontal', 'vertical'] },
    marks: { control: 'object' },
    snapToMarks: { control: 'boolean' },
    disabled: { control: 'boolean' },
    readonly: { control: 'boolean' },
    showValueLabel: { control: 'boolean' },
    color: { control: 'select', options: ['brand', 'danger', 'success', 'warning', 'neutral'] },
    direction: { control: 'select', options: ['', 'rtl'] },
  },
  args: {
    label: 'Volume',
    hint: '',
    value: 40,
    mixed: false,
    mixedLabel: 'Mixed',
    showMixedState: false,
    min: 0,
    max: 100,
    step: 1,
    orientation: 'horizontal',
    marks: false,
    snapToMarks: false,
    disabled: false,
    readonly: false,
    showValueLabel: false,
    color: 'brand',
    direction: '',
  },
} as Meta<SliderStorybookComponent>;

type Story = StoryObj<SliderStorybookComponent>;

export const Default: Story = {};

export const Steps: Story = {
  args: { step: 10, hint: 'Snaps to multiples of 10' },
};

export const ValueLabel: Story = {
  args: { showValueLabel: true },
};

export const Vertical: Story = {
  args: { orientation: 'vertical', showValueLabel: true },
};

export const Marks: Story = {
  args: { step: 10, marks: true, hint: 'A tick at every step' },
};

export const LabelledMarks: Story = {
  args: {
    label: 'Quality',
    value: 1,
    max: 2,
    marks: [
      { value: 0, label: 'Low' },
      { value: 1, label: 'Medium' },
      { value: 2, label: 'High' },
    ],
    snapToMarks: true,
    hint: 'Values snap to the marks; the thumb announces the label',
  },
};

export const VerticalMarks: Story = {
  args: {
    orientation: 'vertical',
    label: 'Quality',
    value: 1,
    max: 2,
    marks: [
      { value: 0, label: 'Low' },
      { value: 1, label: 'Medium' },
      { value: 2, label: 'High' },
    ],
    snapToMarks: true,
  },
};

export const Mixed: Story = {
  args: {
    mixed: true,
    mixedLabel: 'Different volumes',
    showMixedState: true,
    hint: 'The raw value stays intact until a user commits a new position; the thumb parks dimmed at the track start.',
  },
};

export const Disabled: Story = {
  args: { disabled: true },
};

export const RightToLeft: Story = {
  args: { direction: 'rtl', showValueLabel: true },
};
