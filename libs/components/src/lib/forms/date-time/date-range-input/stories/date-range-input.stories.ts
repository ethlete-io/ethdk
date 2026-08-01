import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { DateRangeInputStorybookComponent } from './date-range-input-storybook.component';

export default {
  title: 'Components/Forms/Date Range Input',
  component: DateRangeInputStorybookComponent,
  decorators: [moduleMetadata({ imports: [DateRangeInputStorybookComponent] })],
  argTypes: {
    label: { control: 'text' },
    startPlaceholder: { control: 'text' },
    endPlaceholder: { control: 'text' },
    hint: { control: 'text' },
    start: { control: 'text' },
    end: { control: 'text' },
    mixed: { control: 'boolean' },
    mixedLabel: { control: 'text' },
    showMixedState: { control: false, table: { disable: true } },
    valueFormat: { control: 'text' },
    displayFormat: { control: 'text' },
    precision: { control: 'select', options: ['day', 'month', 'year'] },
    mask: { control: 'boolean' },
    locale: { control: 'select', options: ['default', 'de'] },
    disabled: { control: 'boolean' },
    readonly: { control: 'boolean' },
    color: { control: 'select', options: ['brand', 'danger', 'success', 'warning', 'neutral'] },
  },
  args: {
    label: 'Date range',
    startPlaceholder: 'mm/dd/yyyy',
    endPlaceholder: 'mm/dd/yyyy',
    hint: '',
    start: null,
    end: null,
    mixed: false,
    mixedLabel: 'Mixed',
    showMixedState: false,
    valueFormat: 'yyyy-MM-dd',
    displayFormat: null,
    precision: 'day',
    mask: false,
    locale: 'default',
    disabled: false,
    readonly: false,
    color: 'brand',
  },
} as Meta<DateRangeInputStorybookComponent>;

type Story = StoryObj<DateRangeInputStorybookComponent>;

export const Default: Story = {};

export const Prefilled: Story = {
  args: { start: '2026-07-08', end: '2026-07-23' },
};

export const German: Story = {
  args: { locale: 'de', startPlaceholder: 'tt.mm.jjjj', endPlaceholder: 'tt.mm.jjjj' },
};

export const Masked: Story = {
  args: {
    mask: true,
    displayFormat: 'dd.MM.yyyy',
    startPlaceholder: 'tt.mm.jjjj',
    endPlaceholder: 'tt.mm.jjjj',
    hint: 'Typing is guided by the fixed-width display format - separators insert themselves',
  },
};

export const Mixed: Story = {
  args: {
    start: '2026-07-08',
    end: '2026-07-23',
    mixed: true,
    mixedLabel: 'Mixed',
    showMixedState: true,
    hint: 'The hidden range stays intact and unshown; the mixed label is the placeholder in both fields. Committing either end starts a fresh range.',
  },
};

export const MonthRange: Story = {
  args: {
    precision: 'month',
    valueFormat: 'yyyy-MM',
    startPlaceholder: 'mm/yyyy',
    endPlaceholder: 'mm/yyyy',
    hint: "A month range - 07/2025 – 03/2026 - banded across the picker's month grid",
  },
};
