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
  argTypes: {
    min: {
      control: { type: 'text' },
    },
    max: {
      control: { type: 'text' },
    },
  },
  args: {
    min: '2024-10-21',
    max: '2024-10-28',
  },
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
