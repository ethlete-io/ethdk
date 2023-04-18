/* eslint-disable @typescript-eslint/no-explicit-any */
import { Meta, moduleMetadata, Story } from '@storybook/angular';
import { provideValidatorErrorsService } from '../../../services';
import { StorybookSegmentedButtonComponent } from './components';
import CustomMDXDocumentation from './segmented-button.docs.mdx';

export default {
  title: 'CDK/Forms/Segmented Button',
  component: StorybookSegmentedButtonComponent,
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
} as Meta<StorybookSegmentedButtonComponent>;

const Template: Story<StorybookSegmentedButtonComponent> = (args) => ({
  props: args,
});

export const Default = Template.bind({});
