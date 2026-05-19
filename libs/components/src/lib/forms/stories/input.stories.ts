import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import {
  FormFieldCombinedStorybookComponent,
  FormFieldInputStorybookComponent,
  FormFieldUsernameHintStorybookComponent,
  InputLabelModesStorybookComponent,
  InputVariantsShowcaseStorybookComponent,
  InputWithPrefixSuffixStorybookComponent,
} from './components';

export default {
  title: 'Components/Forms/Input',
  component: FormFieldInputStorybookComponent,
  decorators: [moduleMetadata({ imports: [FormFieldInputStorybookComponent] })],
} as Meta<FormFieldInputStorybookComponent>;

type Story = StoryObj<FormFieldInputStorybookComponent>;

export const Default: Story = {};

export const WithPrefixSuffix: StoryObj<InputWithPrefixSuffixStorybookComponent> = {
  decorators: [moduleMetadata({ imports: [InputWithPrefixSuffixStorybookComponent] })],
  render: () => ({
    template: `<et-sb-input-with-prefix-suffix />`,
  }),
};

export const UsernameLargeHint: StoryObj<FormFieldUsernameHintStorybookComponent> = {
  decorators: [moduleMetadata({ imports: [FormFieldUsernameHintStorybookComponent] })],
  render: () => ({
    template: `<et-sb-form-field-username-hint />`,
  }),
};

const COLOR_OPTIONS = ['brand', 'danger', 'success', 'warning', 'neutral'] as const;

export const VariantsShowcase: StoryObj<InputVariantsShowcaseStorybookComponent> = {
  decorators: [moduleMetadata({ imports: [InputVariantsShowcaseStorybookComponent] })],
  argTypes: {
    color: { control: 'select', options: COLOR_OPTIONS },
    theme: {
      control: 'select',
      options: ['dark', 'light'],
    },
    disabled: {
      control: 'boolean',
    },
    value: {
      control: 'text',
    },
  },
  args: {
    color: 'brand',
    theme: 'dark',
    disabled: false,
    value: '',
  },
  render: (args) => ({
    props: args,
    template: `<et-sb-input-variants-showcase [color]="color" [theme]="theme" [disabled]="disabled" [value]="value" />`,
  }),
};

export const LabelModes: StoryObj<InputLabelModesStorybookComponent> = {
  decorators: [moduleMetadata({ imports: [InputLabelModesStorybookComponent] })],
  render: () => ({
    template: `<et-sb-input-label-modes />`,
  }),
};

export const CombinedForm: StoryObj<FormFieldCombinedStorybookComponent> = {
  decorators: [moduleMetadata({ imports: [FormFieldCombinedStorybookComponent] })],
  render: () => ({
    template: `<et-sb-form-field-combined />`,
  }),
};
