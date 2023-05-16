/* eslint-disable @typescript-eslint/no-explicit-any */
import { applicationConfig, Meta, Story } from '@storybook/angular';
import { provideValidatorErrorsService } from '../../../services';
import { StorybookPasswordInputComponent } from './components';
import CustomMDXDocumentation from './password-input.docs.mdx';

export default {
  title: 'CDK/Forms/Input/Password',
  component: StorybookPasswordInputComponent,
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
} as Meta<StorybookPasswordInputComponent>;

const Template: Story<StorybookPasswordInputComponent> = (args) => ({
  props: args,
});

export const Default = Template.bind({});
