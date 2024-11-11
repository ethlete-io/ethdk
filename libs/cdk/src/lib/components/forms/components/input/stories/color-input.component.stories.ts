import { applicationConfig, Meta, StoryFn } from '@storybook/angular';
import { provideValidatorErrorsService } from '../../../services';
import CustomMDXDocumentation from './color-input.docs.mdx';
import { StorybookColorInputComponent } from './components/color-input-storybook.component';

export default {
  title: 'CDK/Forms/Input/Color',
  component: StorybookColorInputComponent,
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
} as Meta<StorybookColorInputComponent>;

const Template: StoryFn<StorybookColorInputComponent> = (args) => ({
  props: args,
});

export const Default = {
  render: Template,
};
