import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { RangeSliderStorybookComponent } from './range-slider-storybook.component';

export default {
  title: 'Components/Forms/Range slider',
  component: RangeSliderStorybookComponent,
  decorators: [moduleMetadata({ imports: [RangeSliderStorybookComponent] })],
  argTypes: {
    label: { control: 'text' },
    hint: { control: 'text' },
    value: { control: 'object' },
    mixed: { control: 'boolean' },
    mixedLabel: { control: 'text' },
    showMixedState: { control: false, table: { disable: true } },
    minValue: { control: 'number' },
    maxValue: { control: 'number' },
    step: { control: 'number' },
    minDistance: { control: 'number' },
    startLabel: { control: 'text' },
    endLabel: { control: 'text' },
    disabled: { control: 'boolean' },
    readonly: { control: 'boolean' },
    showValueLabel: { control: 'boolean' },
    color: { control: 'select', options: ['brand', 'danger', 'success', 'warning', 'neutral'] },
    direction: { control: 'select', options: ['', 'rtl'] },
  },
  args: {
    label: 'Price range',
    hint: '',
    value: [20, 80],
    mixed: false,
    mixedLabel: 'Mixed',
    showMixedState: false,
    minValue: 0,
    maxValue: 100,
    step: 1,
    minDistance: 0,
    startLabel: 'Minimum',
    endLabel: 'Maximum',
    disabled: false,
    readonly: false,
    showValueLabel: false,
    color: 'brand',
    direction: '',
  },
} as Meta<RangeSliderStorybookComponent>;

type Story = StoryObj<RangeSliderStorybookComponent>;

export const Default: Story = {};

export const MinimumDistance: Story = {
  args: { minDistance: 10, hint: 'The thumbs keep at least 10 apart' },
};

export const ValueLabels: Story = {
  args: { showValueLabel: true },
};

export const Mixed: Story = {
  args: {
    mixed: true,
    mixedLabel: 'Different ranges',
    showMixedState: true,
    hint: 'The raw range stays intact until a user commits a thumb; the first commit writes a fresh range.',
  },
};

export const Disabled: Story = {
  args: { disabled: true },
};
