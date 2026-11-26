import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { MaskedInputStorybookComponent } from './masked-input-storybook.component';

export default {
  title: 'Components/Forms/Masked input',
  component: MaskedInputStorybookComponent,
  decorators: [moduleMetadata({ imports: [MaskedInputStorybookComponent] })],
  argTypes: {
    label: { control: 'text' },
    hint: { control: 'text' },
    placeholder: { control: 'text' },
    preset: { control: 'select', options: ['pattern', 'currency', 'iban', 'card'] },
    pattern: { control: 'text' },
    placeholderChar: { control: 'text' },
    maskValueMode: { control: 'select', options: ['raw', 'masked'] },
    value: { control: 'text' },
    color: { control: 'select', options: ['brand', 'danger', 'success', 'warning', 'neutral'] },
  },
  args: {
    label: 'Date',
    hint: '',
    placeholder: 'DD-MM-YYYY',
    preset: 'pattern',
    pattern: '00-00-0000',
    placeholderChar: '',
    maskValueMode: 'raw',
    value: '',
    color: 'brand',
  },
} as Meta<MaskedInputStorybookComponent>;

type Story = StoryObj<MaskedInputStorybookComponent>;

export const Default: Story = {};

export const GuidePlaceholders: Story = {
  args: { placeholderChar: '_', hint: 'Unfilled slots render while the field is focused' },
};

export const Currency: Story = {
  args: { label: 'Amount', preset: 'currency', placeholder: '0,00' },
};

export const Iban: Story = {
  args: { label: 'IBAN', preset: 'iban', placeholder: 'DE00 0000 0000 0000 0000 00' },
};

export const Card: Story = {
  args: { label: 'Card number', preset: 'card', placeholder: '0000 0000 0000 0000' },
};

export const MaskedValueMode: Story = {
  args: { maskValueMode: 'masked', hint: 'The form value keeps the literals' },
};
