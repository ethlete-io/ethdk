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
    valueFormat: { control: 'text' },
    displayFormat: { control: 'text' },
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
    valueFormat: 'yyyy-MM-dd',
    displayFormat: 'P',
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
