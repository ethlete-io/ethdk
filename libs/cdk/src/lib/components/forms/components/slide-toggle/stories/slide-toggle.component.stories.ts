import { applicationConfig, Meta, StoryFn } from '@storybook/angular';
import { provideValidatorErrorsService } from '../../../services';
import { StorybookSlideToggleComponent } from './components';
import CustomMDXDocumentation from './slide-toggle.docs.mdx';

export default {
  title: 'CDK/Forms/Slide toggle',
  component: StorybookSlideToggleComponent,
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
} as Meta<StorybookSlideToggleComponent>;

const Template: StoryFn<StorybookSlideToggleComponent> = (args) => ({
  props: args,
});

export const Default = {
  render: Template,
};
