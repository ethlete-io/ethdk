/* eslint-disable @typescript-eslint/no-explicit-any */
import { applicationConfig, Meta, Story } from '@storybook/angular';
import { provideValidatorErrorsService } from '../../../services';
import { StorybookTextareaInputComponent } from './components/textarea-input-storybook.component';
import CustomMDXDocumentation from './textarea-input.docs.mdx';

export default {
  title: 'CDK/Forms/Input/Textarea',
  component: StorybookTextareaInputComponent,
  decorators: [
    applicationConfig({
      providers: [provideValidatorErrorsService()],
    }),
  ],
  argTypes: {
    cols: {
      control: { type: 'number' },
    },
    rows: {
      control: { type: 'number' },
    },
  },
  args: {
    cols: 30,
    rows: 5,
  },
  parameters: {
    docs: {
      page: CustomMDXDocumentation,
    },
  },
} as Meta<StorybookTextareaInputComponent>;

const Template: Story<StorybookTextareaInputComponent> = (args) => ({
  props: args,
});

export const Default = Template.bind({});
