import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { DateInputStorybookComponent } from './date-input-storybook.component';

export default {
  title: 'Components/Forms/Date Input',
  component: DateInputStorybookComponent,
  decorators: [moduleMetadata({ imports: [DateInputStorybookComponent] })],
  argTypes: {
    label: { control: 'text' },
    placeholder: { control: 'text' },
    hint: { control: 'text' },
    value: { control: 'text' },
    mixed: { control: 'boolean' },
    mixedLabel: { control: 'text' },
    showMixedState: { control: false, table: { disable: true } },
    valueFormat: { control: 'text' },
    displayFormat: { control: 'text' },
    precision: { control: 'select', options: ['day', 'month', 'year'] },
    mask: { control: 'boolean' },
    locale: { control: 'select', options: ['default', 'de'] },
    constrained: { control: 'boolean' },
    disabled: { control: 'boolean' },
    readonly: { control: 'boolean' },
    required: { control: 'boolean' },
    color: { control: 'select', options: ['brand', 'danger', 'success', 'warning', 'neutral'] },
  },
  args: {
    label: 'Date',
    placeholder: 'mm/dd/yyyy',
    hint: '',
    value: null,
    mixed: false,
    mixedLabel: 'Mixed',
    showMixedState: false,
    valueFormat: 'yyyy-MM-dd',
    displayFormat: null,
    precision: 'day',
    mask: false,
    locale: 'default',
    constrained: false,
    disabled: false,
    readonly: false,
    required: false,
    color: 'brand',
  },
} as Meta<DateInputStorybookComponent>;

type Story = StoryObj<DateInputStorybookComponent>;

export const Default: Story = {};

export const Prefilled: Story = {
  args: { value: '2026-12-24' },
};

export const German: Story = {
  args: { locale: 'de', placeholder: 'tt.mm.jjjj', hint: 'Deutsches Datumsformat (P mit de-Locale)' },
};

export const Constrained: Story = {
  args: { constrained: true, hint: 'Only dates from a week ago up to 60 days ahead' },
};

export const Masked: Story = {
  args: {
    mask: true,
    displayFormat: 'dd.MM.yyyy',
    placeholder: 'tt.mm.jjjj',
    hint: 'Typing is guided by the fixed-width display format — separators insert themselves',
  },
};

export const MonthPrecision: Story = {
  args: {
    precision: 'month',
    valueFormat: 'yyyy-MM',
    placeholder: 'mm/yyyy',
    hint: 'A month picker: the format comes from the precision, and the picker selects in its month grid',
  },
};

export const YearPrecision: Story = {
  args: {
    precision: 'year',
    valueFormat: 'yyyy',
    placeholder: 'yyyy',
    hint: 'A year picker — the calendar opens on its year grid and picks there',
  },
};

export const Mixed: Story = {
  args: {
    value: '2026-12-24',
    mixed: true,
    mixedLabel: 'Mixed dates',
    showMixedState: true,
    hint: 'The hidden date stays intact and unshown; the mixed label is the placeholder. Parsing a typed date or picking one commits a replacement.',
  },
};
