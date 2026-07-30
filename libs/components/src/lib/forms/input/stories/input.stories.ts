import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { FormFieldInputStorybookComponent } from './input-storybook.component';

export default {
  title: 'Components/Forms/Input',
  component: FormFieldInputStorybookComponent,
  decorators: [moduleMetadata({ imports: [FormFieldInputStorybookComponent] })],
  argTypes: {
    appearance: { control: 'select', options: ['box', 'underline'] },
    fill: { control: 'select', options: ['transparent', 'filled'] },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
    labelMode: { control: 'select', options: ['static', 'inline', 'floating-inside', 'floating-outside'] },
    type: { control: 'select', options: ['text', 'email', 'password', 'search', 'tel', 'number'] },
    label: { control: 'text' },
    ariaLabel: { control: 'text' },
    placeholder: { control: 'text' },
    hint: { control: 'text' },
    value: { control: 'text' },
    mixed: { control: 'boolean' },
    mixedLabel: { control: 'text' },
    showMixedState: { control: false, table: { disable: true } },
    disabled: { control: 'boolean' },
    required: { control: 'boolean' },
    showPrefix: { control: 'boolean' },
    showSuffix: { control: 'boolean' },
    showPrefixIcon: { control: 'boolean' },
    showSuffixIcon: { control: 'boolean' },
    color: { control: 'select', options: ['brand', 'danger', 'success', 'warning', 'neutral'] },
  },
  args: {
    appearance: 'box',
    fill: 'transparent',
    size: 'md',
    labelMode: 'static',
    type: 'text',
    label: 'Label',
    ariaLabel: 'Search',
    placeholder: 'Placeholder',
    hint: '',
    value: '',
    mixed: false,
    mixedLabel: 'Mixed',
    showMixedState: false,
    disabled: false,
    required: false,
    showPrefix: false,
    showSuffix: false,
    showPrefixIcon: false,
    showSuffixIcon: false,
    color: 'brand',
  },
} as Meta<FormFieldInputStorybookComponent>;

type Story = StoryObj<FormFieldInputStorybookComponent>;

export const Default: Story = {};

/**
 * The label is optional. Clear `label` (empty) and the `<et-label>` is dropped — the field
 * reserves no label band, and the control is named by its `aria-label` instead. A placeholder is
 * not an accessible name, so `aria-label`/`aria-labelledby` is required whenever the label is
 * omitted (a missing name throws `ET2201` in dev mode).
 */
export const NoLabel: Story = {
  args: {
    label: '',
    ariaLabel: 'Search',
    placeholder: 'Search…',
  },
};

/**
 * An affix takes a text glyph or an `[etIcon]`. Icons need no size class — the field shell sizes
 * them via `--et-form-field-affix-icon-size` (16px), matching the other in-field icons.
 */
export const IconAffixes: Story = {
  args: {
    label: 'API key',
    placeholder: 'sk-…',
    showPrefixIcon: true,
    showSuffixIcon: true,
  },
};

export const Mixed: Story = {
  args: {
    value: 'shared draft title',
    mixed: true,
    mixedLabel: 'Mixed values',
    showMixedState: true,
    hint: 'The raw value stays hidden and intact until typing commits a replacement; the mixed label shows as the placeholder.',
  },
};
