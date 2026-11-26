import { applicationConfig, Meta, StoryFn } from '@storybook/angular';
import { provideValidatorErrorsService } from '../../../services';
import { StorybookSearchInputComponent } from './components';
import CustomMDXDocumentation from './search-input.docs.mdx';

export default {
  title: 'CDK/Forms/Input/Search',
  component: StorybookSearchInputComponent,
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
} as Meta<StorybookSearchInputComponent>;

const Template: StoryFn<StorybookSearchInputComponent> = (args) => ({
  props: args,
});

export const Default = {
  render: Template,
};
