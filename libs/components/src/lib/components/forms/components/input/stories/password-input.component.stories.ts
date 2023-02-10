/* eslint-disable @typescript-eslint/no-explicit-any */
import { Meta, moduleMetadata, Story } from '@storybook/angular';
import { provideValidatorErrorsService } from '../../../services';
import { StorybookPasswordInputComponent } from './components';
import CustomMDXDocumentation from './password-input.docs.mdx';

export default {
  title: 'Components/Forms/Input',
  component: StorybookPasswordInputComponent,
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
} as Meta<StorybookPasswordInputComponent>;

const Template: Story<StorybookPasswordInputComponent> = (args) => ({
  props: args,
});

export const Password = Template.bind({});
