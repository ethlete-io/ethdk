import { Meta, moduleMetadata, StoryFn } from '@storybook/angular';
import { provideValidatorErrorsService } from '../../../services';
import { StorybookEmailInputComponent } from './components';
import CustomMDXDocumentation from './email-input.docs.mdx';

export default {
  title: 'CDK/Forms/Input/Email',
  component: StorybookEmailInputComponent,
  decorators: [
    moduleMetadata({
      providers: [provideValidatorErrorsService()],
    }),
  ],
  parameters: {
    docs: {
      page: CustomMDXDocumentation,
    },
  },
} as Meta<StorybookEmailInputComponent>;

const Template: StoryFn<StorybookEmailInputComponent> = (args) => ({
  props: args,
});

export const Default = {
  render: Template,
};
