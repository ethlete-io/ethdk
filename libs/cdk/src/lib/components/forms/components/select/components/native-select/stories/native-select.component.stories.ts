/* eslint-disable @typescript-eslint/no-explicit-any */
import { applicationConfig, Meta, Story } from '@storybook/angular';
import { provideValidatorErrorsService } from '../../../../../services';
import { StorybookNativeSelectComponent } from './components';
import CustomMDXDocumentation from './native-select.docs.mdx';

export default {
  title: 'CDK/Forms/Select/Native',
  component: StorybookNativeSelectComponent,
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
} as Meta<StorybookNativeSelectComponent>;

const Template: Story<StorybookNativeSelectComponent> = (args) => ({
  props: args,
});

export const Default = Template.bind({});
