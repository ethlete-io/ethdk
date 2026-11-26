import { applicationConfig, Meta, StoryFn } from '@storybook/angular';
import { provideValidatorErrorsService } from '../../../services';
import { StorybookTextInputComponent } from './components';
import CustomMDXDocumentation from './text-input.docs.mdx';

export default {
  title: 'CDK/Forms/Input/Text',
  component: StorybookTextInputComponent,
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
} as Meta<StorybookTextInputComponent>;

const Template: StoryFn<StorybookTextInputComponent> = (args) => ({
  props: args,
});

export const Default = {
  render: Template,
};
