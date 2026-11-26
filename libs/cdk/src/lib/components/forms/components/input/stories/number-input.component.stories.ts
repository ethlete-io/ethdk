import { applicationConfig, Meta, StoryFn } from '@storybook/angular';
import { provideValidatorErrorsService } from '../../../services';
import { StorybookNumberInputComponent } from './components';
import CustomMDXDocumentation from './number-input.docs.mdx';

export default {
  title: 'CDK/Forms/Input/Number',
  component: StorybookNumberInputComponent,
  decorators: [
    applicationConfig({
      providers: [provideValidatorErrorsService()],
    }),
  ],
  argTypes: {
    min: {
      control: { type: 'text' },
    },
    max: {
      control: { type: 'text' },
    },
  },
  args: {
    min: '0',
    max: '9',
  },
  parameters: {
    docs: {
      page: CustomMDXDocumentation,
    },
  },
} as Meta<StorybookNumberInputComponent>;

const Template: StoryFn<StorybookNumberInputComponent> = (args) => ({
  props: args,
});

export const Default = {
  render: Template,
};
