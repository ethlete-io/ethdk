/* eslint-disable @typescript-eslint/no-explicit-any */
import { applicationConfig, Meta, Story } from '@storybook/angular';
import { provideValidatorErrorsService } from '../../../../../services';
import CustomMDXDocumentation from './combobox.docs.mdx';
import { StorybookComboboxComponent } from './components';

export default {
  title: 'Experimental/CDK/Forms/Select/Combobox',
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

const Template: Story<StorybookComboboxComponent> = (args) => ({
  props: args,
});

export const Default = Template.bind({});

Default.args = {
  options: [
    { id: '1', name: 'Option 1' },
    { id: '2', name: 'Option 2' },
    { id: '3', name: 'Option 3' },
    { id: '4', name: 'Option 4' },
    { id: '5', name: 'Option 5' },
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
};

export const Primitive = Template.bind({});

Primitive.args = {
  options: ['Option 1', 'Option 2', 'Option 3', 'Option 4', 'Option 5'],
  initialValue: 'Option 3',
  bindLabel: undefined,
  bindValue: undefined,
  multiple: false,
  allowCustomValues: true,
  _formValue: 'Option 3',
};
