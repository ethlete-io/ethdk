/* eslint-disable @typescript-eslint/no-explicit-any */

import { applicationConfig, Meta, StoryFn } from '@storybook/angular';
import { provideValidatorErrorsService } from '../../../services';
import { StorybookDateTimeInputComponent } from './components';
import CustomMDXDocumentation from './date-time-input.docs.mdx';

export default {
  title: 'CDK/Forms/Input/Date Time',
  component: StorybookDateTimeInputComponent,
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
} as Meta<StorybookDateTimeInputComponent>;

const Template: StoryFn<StorybookDateTimeInputComponent> = (args) => ({
  props: args,
});

export const Default = {
  render: Template,
};
