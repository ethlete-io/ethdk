/* eslint-disable @typescript-eslint/no-explicit-any */
import { Meta, moduleMetadata, Story } from '@storybook/angular';
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

const Template: Story<StorybookEmailInputComponent> = (args) => ({
  props: args,
});

export const Default = Template.bind({});
