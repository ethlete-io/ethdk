import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { DateTimeInputStorybookComponent } from './date-time-input-storybook.component';

export default {
  title: 'Components/Forms/Date Time Input',
  component: DateTimeInputStorybookComponent,
  decorators: [moduleMetadata({ imports: [DateTimeInputStorybookComponent] })],
  argTypes: {
    label: { control: 'text' },
    placeholder: { control: 'text' },
    hint: { control: 'text' },
    value: { control: 'text' },
    valueFormat: { control: 'text' },
    displayFormat: { control: 'text' },
    minuteStep: { control: 'number' },
    secondStep: { control: 'number' },
    locale: { control: 'select', options: ['default', 'de'] },
    disabled: { control: 'boolean' },
    readonly: { control: 'boolean' },
    required: { control: 'boolean' },
    color: { control: 'select', options: ['brand', 'danger', 'success', 'warning', 'neutral'] },
  },
  args: {
    label: 'Date & time',
    placeholder: 'mm/dd/yyyy, hh:mm',
    hint: '',
    value: null,
    valueFormat: undefined,
    displayFormat: 'Pp',
    minuteStep: 5,
    secondStep: 1,
    locale: 'default',
    disabled: false,
    readonly: false,
    required: false,
    color: 'brand',
  },
} as Meta<DateTimeInputStorybookComponent>;

type Story = StoryObj<DateTimeInputStorybookComponent>;

export const Default: Story = {};

export const Prefilled: Story = {
  args: { value: '2026-07-16T14:30:00+02:00' },
};

export const CustomFormats: Story = {
  args: {
    valueFormat: 'yyyy-MM-dd HH:mm',
    displayFormat: 'dd.MM.yyyy HH:mm',
    placeholder: 'dd.mm.yyyy hh:mm',
    hint: 'Custom wire and display formats',
  },
};

export const German: Story = {
  args: { locale: 'de', hint: '24-Stunden-Anzeige (Pp mit de-Locale)' },
};
