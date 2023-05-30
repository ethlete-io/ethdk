/* eslint-disable @typescript-eslint/no-explicit-any */
import { applicationConfig, Meta, Story } from '@storybook/angular';
import { provideValidatorErrorsService } from '../../../services';
import { StorybookTextInputComponent } from './components';
import CustomMDXDocumentation from './text-input.docs.mdx';

export default {
  title: 'CDK/Forms/Input/Text',
  component: StorybookTextInputComponent,
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
} as Meta<StorybookTextInputComponent>;

const Template: Story<StorybookTextInputComponent> = (args) => ({
  props: args,
});

export const Default = Template.bind({});
