import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { FormFieldCheckboxStorybookComponent } from './checkbox-storybook.component';

export default {
  title: 'Components/Forms/Checkbox',
  component: FormFieldCheckboxStorybookComponent,
  decorators: [moduleMetadata({ imports: [FormFieldCheckboxStorybookComponent] })],
  argTypes: {
    variant: { control: 'radio', options: ['plain', 'card'] },
    color: { control: 'select', options: ['brand', 'danger', 'success', 'warning', 'neutral'] },
    hint: { control: 'text' },
    disabled: { control: 'boolean' },
    readonly: { control: 'boolean' },
    required: { control: 'boolean' },
    indeterminate: { control: 'boolean' },
  },
  args: {
    variant: 'plain',
    color: 'brand',
    hint: '',
    disabled: false,
    readonly: false,
    required: false,
    indeterminate: false,
  },
} as Meta<FormFieldCheckboxStorybookComponent>;

type Story = StoryObj<FormFieldCheckboxStorybookComponent>;

export const Default: Story = {};

export const Readonly: Story = {
  args: { readonly: true, hint: 'View-only: normal look, focusable, cannot be toggled' },
};

export const Indeterminate: Story = {
  args: { indeterminate: true, hint: 'Tri-state: toggling an indeterminate checkbox resolves it to checked' },
};

export const Card: Story = {
  args: { variant: 'card', hint: 'Cards give each option room for a hint.' },
  parameters: {
    docs: {
      description: {
        story:
          'The card preset lives on `et-choice-field`, not on the control, so a switch gets it too. The whole ' +
          'panel is clickable and the checked state shows on its border — `:has()` is how the wrapper learns the ' +
          "control's state.",
      },
    },
  },
};
