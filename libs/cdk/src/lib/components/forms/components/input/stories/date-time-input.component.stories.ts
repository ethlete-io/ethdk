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
  argTypes: {
    min: {
      control: { type: 'text' },
    },
    max: {
      control: { type: 'text' },
    },
  },
  args: {
    min: '2024-09-11T00:00',
    max: '2024-09-14T00:00',
  },
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
