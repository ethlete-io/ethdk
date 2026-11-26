import { applicationConfig, Meta, StoryFn } from '@storybook/angular';
import { provideValidatorErrorsService } from '../../../services';
import { StorybookTelInputComponent } from './components';
import CustomMDXDocumentation from './tel-input.docs.mdx';

export default {
  title: 'CDK/Forms/Input/Tel',
  component: StorybookTelInputComponent,
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
} as Meta<StorybookTelInputComponent>;

const Template: StoryFn<StorybookTelInputComponent> = (args) => ({
  props: args,
});

export const Default = {
  render: Template,
};
