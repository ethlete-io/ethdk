import { applicationConfig, Meta, StoryFn } from '@storybook/angular';
import { provideValidatorErrorsService } from '../../../services';
import { StorybookSegmentedButtonComponent } from './components';
import CustomMDXDocumentation from './segmented-button.docs.mdx';

export default {
  title: 'CDK/Forms/Segmented Button',
  component: StorybookSegmentedButtonComponent,
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
  args: {
    renderAs: 'buttons',
  },
  argTypes: {
    renderAs: {
      control: {
        type: 'select',
      },
      options: ['buttons', 'tabs'],
    },
  },
} as Meta<StorybookSegmentedButtonComponent>;

const Template: StoryFn<StorybookSegmentedButtonComponent> = (args) => ({
  props: args,
});

export const Default = {
  render: Template,
};
