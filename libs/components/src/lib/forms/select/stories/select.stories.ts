import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import {
  FormFieldSelectAsyncStorybookComponent,
  FormFieldSelectCountryStorybookComponent,
  FormFieldSelectStorybookComponent,
} from './select-storybook.component';

export default {
  title: 'Components/Forms/Select',
  component: FormFieldSelectStorybookComponent,
  decorators: [moduleMetadata({ imports: [FormFieldSelectStorybookComponent] })],
  argTypes: {
    appearance: { control: 'select', options: ['box', 'underline'] },
    fill: { control: 'select', options: ['transparent', 'filled'] },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
    labelMode: { control: 'select', options: ['static', 'inline', 'floating-inside', 'floating-outside'] },
    label: { control: 'text' },
    placeholder: { control: 'text' },
    hint: { control: 'text' },
    value: { control: 'select', options: [null, 'apple', 'banana', 'cherry'] },
    multiple: { control: 'boolean' },
    withSearch: { control: 'boolean' },
    allowCustomValues: { control: 'boolean' },
    disabled: { control: 'boolean' },
    readonly: { control: 'boolean' },
    required: { control: 'boolean' },
    color: { control: 'select', options: ['brand', 'danger', 'success', 'warning', 'neutral'] },
  },
  args: {
    appearance: 'box',
    fill: 'transparent',
    size: 'md',
    labelMode: 'static',
    label: 'Fruit',
    placeholder: 'Pick a fruit',
    hint: '',
    value: null,
    multiple: false,
    withSearch: false,
    allowCustomValues: false,
    disabled: false,
    readonly: false,
    required: false,
    color: 'brand',
  },
} as Meta<FormFieldSelectStorybookComponent>;

type Story = StoryObj<FormFieldSelectStorybookComponent>;

export const Default: Story = {};

export const Preselected: Story = {
  args: { value: 'banana' },
};

export const Required: Story = {
  args: { required: true, hint: 'Choosing one is mandatory' },
};

export const Disabled: Story = {
  args: { disabled: true },
};

export const Multiple: Story = {
  args: { multiple: true, value: ['apple', 'cherry'], label: 'Fruits', placeholder: 'Pick fruits' },
};

export const Searchable: Story = {
  args: { withSearch: true },
};

export const CustomValues: Story = {
  args: {
    withSearch: true,
    allowCustomValues: true,
    multiple: true,
    label: 'Tags',
    placeholder: 'Pick or create tags',
  },
};

export const AsyncOptions: StoryObj<FormFieldSelectAsyncStorybookComponent> = {
  decorators: [moduleMetadata({ imports: [FormFieldSelectAsyncStorybookComponent] })],
  render: () => ({ template: `<et-sb-form-field-select-async />` }),
};

export const CountryWithFlags: StoryObj<FormFieldSelectCountryStorybookComponent> = {
  decorators: [moduleMetadata({ imports: [FormFieldSelectCountryStorybookComponent] })],
  render: () => ({ template: `<et-sb-form-field-select-country />` }),
};
