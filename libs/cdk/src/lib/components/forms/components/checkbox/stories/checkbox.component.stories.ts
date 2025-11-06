import { applicationConfig, Meta, StoryFn } from '@storybook/angular';
import { provideValidatorErrorsService } from '../../../services';
import CustomMDXDocumentation from './checkbox.docs.mdx';
import { StorybookCheckboxComponent } from './components';

export default {
  title: 'CDK/Forms/Checkbox',
  component: StorybookCheckboxComponent,
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
} as Meta<StorybookCheckboxComponent>;

const Template: StoryFn<StorybookCheckboxComponent> = (args) => ({
  props: args,
});

export const Default = {
  render: Template,
};
