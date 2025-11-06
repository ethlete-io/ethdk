import { applicationConfig, Meta, StoryFn } from '@storybook/angular';
import { provideValidatorErrorsService } from '../../../services';
import { StorybookPasswordInputComponent } from './components';
import CustomMDXDocumentation from './password-input.docs.mdx';

export default {
  title: 'CDK/Forms/Input/Password',
  component: StorybookPasswordInputComponent,
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
} as Meta<StorybookPasswordInputComponent>;

const Template: StoryFn<StorybookPasswordInputComponent> = (args) => ({
  props: args,
});

export const Default = {
  render: Template,
};
