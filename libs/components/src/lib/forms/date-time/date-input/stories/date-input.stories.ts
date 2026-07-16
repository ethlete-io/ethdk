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
    valueFormat: { control: 'text' },
    displayFormat: { control: 'text' },
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
    valueFormat: 'yyyy-MM-dd',
    displayFormat: 'P',
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
