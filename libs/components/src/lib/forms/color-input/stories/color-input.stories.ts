import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { FormFieldColorInputStorybookComponent } from './color-input-storybook.component';

export default {
  title: 'Components/Forms/Color Input',
  component: FormFieldColorInputStorybookComponent,
  decorators: [moduleMetadata({ imports: [FormFieldColorInputStorybookComponent] })],
  argTypes: {
    appearance: { control: 'select', options: ['box', 'underline'] },
    fill: { control: 'select', options: ['transparent', 'filled'] },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
    labelMode: { control: 'select', options: ['static', 'inline', 'floating-inside', 'floating-outside'] },
    label: { control: 'text' },
    hint: { control: 'text' },
    value: { control: 'color' },
    mixed: { control: 'boolean' },
    mixedLabel: { control: 'text' },
    showMixedState: { control: false, table: { disable: true } },
    disabled: { control: 'boolean' },
    readonly: { control: 'boolean' },
    required: { control: 'boolean' },
    alpha: { control: 'boolean' },
    swatches: { control: 'text' },
    color: { control: 'select', options: ['brand', 'danger', 'success', 'warning', 'neutral'] },
  },
  args: {
    appearance: 'box',
    fill: 'transparent',
    size: 'md',
    labelMode: 'static',
    label: 'Color',
    hint: '',
    value: null,
    mixed: false,
    mixedLabel: 'Mixed',
    showMixedState: false,
    disabled: false,
    readonly: false,
    required: false,
    alpha: false,
    swatches: '',
    color: 'brand',
  },
} as Meta<FormFieldColorInputStorybookComponent>;

type Story = StoryObj<FormFieldColorInputStorybookComponent>;

export const Default: Story = {};

export const WithAlpha: Story = {
  args: {
    value: '#3366ffcc',
    alpha: true,
    hint: 'With alpha on, the picker gains an opacity track and the value widens to #rrggbbaa.',
  },
};

export const WithSwatches: Story = {
  args: {
    swatches: '#ff5533, #33bb88, #3366ff, #ffcc00, #111111, #ffffff',
    hint: 'Presets are given in any notation the color validators accept and render as canonical hex.',
  },
};

export const Readonly: Story = {
  args: {
    value: '#ff5533',
    readonly: true,
    hint: 'A read-only control keeps its tab stop but refuses to open the picker.',
  },
};

export const Mixed: Story = {
  args: {
    value: '#ff5533',
    mixed: true,
    mixedLabel: 'Mixed colors',
    showMixedState: true,
    hint: 'The swatch renders neutral (never the hidden raw color) until picking a color commits a replacement.',
  },
};
