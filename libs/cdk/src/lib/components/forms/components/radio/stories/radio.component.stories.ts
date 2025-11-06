import { applicationConfig, Meta, StoryFn } from '@storybook/angular';
import { provideValidatorErrorsService } from '../../../services';
import { StorybookRadioComponent } from './components';
import CustomMDXDocumentation from './radio.docs.mdx';

export default {
  title: 'CDK/Forms/Radio',
  component: StorybookRadioComponent,
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
} as Meta<StorybookRadioComponent>;

const Template: StoryFn<StorybookRadioComponent> = (args) => ({
  props: args,
});

export const Default = {
  render: Template,
};
