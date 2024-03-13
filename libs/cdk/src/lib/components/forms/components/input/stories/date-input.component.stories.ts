/* eslint-disable @typescript-eslint/no-explicit-any */

import { applicationConfig, Meta, StoryFn } from '@storybook/angular';
import { provideValidatorErrorsService } from '../../../services';
import { StorybookDateInputComponent } from './components';
import CustomMDXDocumentation from './date-input.docs.mdx';

export default {
  title: 'CDK/Forms/Input/Date',
  component: StorybookDateInputComponent,
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
} as Meta<StorybookDateInputComponent>;

const Template: StoryFn<StorybookDateInputComponent> = (args) => ({
  props: args,
});

export const Default = {
  render: Template,
};
