import { applicationConfig, Meta, StoryFn } from '@storybook/angular';
import { provideValidatorErrorsService } from '../../../services';
import { StorybookTimeInputComponent } from './components';
import CustomMDXDocumentation from './time-input.docs.mdx';

export default {
  title: 'CDK/Forms/Input/Time',
  component: StorybookTimeInputComponent,
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
    min: '12:00',
    max: '16:00',
  },
  parameters: {
    docs: {
      page: CustomMDXDocumentation,
    },
  },
} as Meta<StorybookTimeInputComponent>;

const Template: StoryFn<StorybookTimeInputComponent> = (args) => ({
  props: args,
});

export const Default = {
  render: Template,
};
