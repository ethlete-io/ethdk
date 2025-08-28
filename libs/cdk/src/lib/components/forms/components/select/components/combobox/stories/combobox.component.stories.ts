import { applicationConfig, Meta, StoryFn } from '@storybook/angular';
import { provideValidatorErrorsService } from '../../../../../services';
import CustomMDXDocumentation from './combobox.docs.mdx';
import { StorybookComboboxComponent } from './components';

export default {
  title: 'CDK/Forms/Select/Combobox',
  component: StorybookComboboxComponent,
  decorators: [
    applicationConfig({
      providers: [provideValidatorErrorsService()],
    }),
  ],
  parameters: {
    docs: {
      page: CustomMDXDocumentation,
    },
  },
  argTypes: {
    options: {
      control: {
        type: 'object',
      },
    },
    bindLabel: {
      control: {
        type: 'text',
      },
    },
    bindValue: {
      control: {
        type: 'text',
      },
    },
    allowCustomValues: {
      control: {
        type: 'boolean',
      },
    },
    error: {
      control: {
        type: 'text',
      },
    },
    loading: {
      control: {
        type: 'boolean',
      },
    },
    initialValue: {
      control: {
        type: 'object',
      },
    },
    multiple: {
      control: {
        type: 'boolean',
      },
    },
    filterInternal: {
      control: {
        type: 'boolean',
      },
    },
    placeholder: {
      control: {
        type: 'text',
      },
    },
  },
  args: {
    options: [],
    allowCustomValues: false,
    error: null,
    loading: false,
    initialValue: '1',
    multiple: true,
    filterInternal: true,
    placeholder: 'Select an option',
    bindLabel: 'name',
    bindValue: 'id',
    _customOptionTemplate: false,
    _customOptionComponent: false,
  },
} as Meta<StorybookComboboxComponent>;

const Template: StoryFn<StorybookComboboxComponent> = (args) => ({
  props: args,
});

export const Default = {
  render: Template,

  args: {
    options: [
      { id: '1', name: 'Option 1' },
      { id: '2', name: 'Option 2 (disabled)', disabled: true },
      { id: '3', name: 'Option 3' },
      { id: '4', name: 'Option 4' },
      { id: '5', name: 'Option 5' },
      { id: '6', name: 'Option 6' },
      { id: '7', name: 'Option 7' },
      { id: '8', name: 'Option 8' },
      { id: '9', name: 'Option 9' },
      { id: '10', name: 'Option 10' },
      { id: '11', name: 'Option 11' },
      { id: '12', name: 'Option 12' },
      { id: '13', name: 'Option 13' },
      { id: '14', name: 'Option 14' },
      { id: '15', name: 'Option 15' },
      { id: '16', name: 'Option 16' },
      { id: '17', name: 'Option 17' },
      { id: '18', name: 'Option 18' },
      { id: '19', name: 'Option 19' },
      { id: '20', name: 'Option 20' },
    ],
    initialValue: [
      { id: '1', name: 'Option 1' },
      { id: '3', name: 'Option 3' },
      { id: '7', name: 'Option 7' },
    ],
    bindLabel: 'name',
    bindValue: 'id',
    multiple: true,
    _formValue: ['1', '3', '7'],
  },
};

export const Primitive = {
  render: Template,

  args: {
    options: ['Option 1', 'Option 2', 'Option 3', 'Option 4', 'Option 5'],
    initialValue: 'Option 3',
    bindLabel: undefined,
    bindValue: undefined,
    multiple: false,
    _formValue: 'Option 3',
  },
};
