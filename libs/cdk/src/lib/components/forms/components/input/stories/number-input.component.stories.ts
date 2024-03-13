/* eslint-disable @typescript-eslint/no-explicit-any */
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
