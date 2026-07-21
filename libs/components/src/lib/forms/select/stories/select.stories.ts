import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import {
  FormFieldSelectAddNewStorybookComponent,
  FormFieldSelectAsyncStorybookComponent,
  FormFieldSelectCountryStorybookComponent,
  FormFieldSelectManyOptionsStorybookComponent,
  FormFieldSelectOptionTemplateStorybookComponent,
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
    mixed: { control: 'boolean' },
    mixedLabel: { control: 'text' },
    showMixedState: { control: false, table: { disable: true } },
    multiple: { control: 'boolean' },
    withSearch: { control: 'boolean' },
    allowCustomValues: { control: 'boolean' },
    customValueSeparators: { control: 'object' },
    commitCustomValueOnClose: { control: 'boolean' },
    maxSelection: { control: 'number' },
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
    mixed: false,
    mixedLabel: 'Mixed',
    showMixedState: false,
    multiple: false,
    withSearch: false,
    allowCustomValues: false,
    customValueSeparators: [],
    commitCustomValueOnClose: false,
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

export const Mixed: Story = {
  args: {
    value: 'banana',
    mixed: true,
    mixedLabel: 'Different values',
    showMixedState: true,
    hint: 'The raw value stays intact until a user commits a new selection; Mixed shows the live presentation state.',
  },
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

export const MixedMultiple: Story = {
  args: {
    multiple: true,
    value: ['apple', 'cherry'],
    mixed: true,
    mixedLabel: 'Different fruit sets',
    showMixedState: true,
    withSearch: true,
    label: 'Fruits',
    placeholder: 'Pick fruits',
    hint: 'The first committed option replaces the hidden raw selection, then regular multi-select toggling resumes.',
  },
};

export const Searchable: Story = {
  args: { withSearch: true },
};

export const CustomValues: Story = {
  args: {
    withSearch: true,
    allowCustomValues: true,
    customValueSeparators: [','],
    commitCustomValueOnClose: true,
    multiple: true,
    label: 'Tags',
    placeholder: 'Pick or create tags',
    hint: 'Comma commits while typing, pastes split on commas/newlines, pending text commits on close',
  },
};

export const MaxSelection: Story = {
  args: {
    withSearch: true,
    allowCustomValues: true,
    multiple: true,
    maxSelection: 3,
    label: 'Tags',
    placeholder: 'Pick or create up to 3 tags',
    hint: 'At 3 selected values the search input locks — remove a chip to free a slot',
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

export const AddNewOption: StoryObj<FormFieldSelectAddNewStorybookComponent> = {
  decorators: [moduleMetadata({ imports: [FormFieldSelectAddNewStorybookComponent] })],
  render: () => ({ template: `<et-sb-form-field-select-add-new />` }),
};

export const ManyOptions: StoryObj<FormFieldSelectManyOptionsStorybookComponent> = {
  decorators: [moduleMetadata({ imports: [FormFieldSelectManyOptionsStorybookComponent] })],
  render: () => ({ template: `<et-sb-form-field-select-many-options />` }),
};

export const OptionTemplate: StoryObj<FormFieldSelectOptionTemplateStorybookComponent> = {
  decorators: [moduleMetadata({ imports: [FormFieldSelectOptionTemplateStorybookComponent] })],
  render: () => ({ template: `<et-sb-form-field-select-option-template />` }),
};
