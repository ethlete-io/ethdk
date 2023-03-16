/* eslint-disable @typescript-eslint/no-explicit-any */
import { Meta, moduleMetadata, Story } from '@storybook/angular';
import { provideValidatorErrorsService } from '../../../services';
import { StorybookTextareaInputComponent } from './components/textarea-input-storybook.component';
import CustomMDXDocumentation from './text-input.docs.mdx';

export default {
  title: 'Components/Forms/Textarea',
  component: StorybookTextareaInputComponent,
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
} as Meta<StorybookTextareaInputComponent>;

const Template: Story<StorybookTextareaInputComponent> = (args) => ({
  props: args,
});

export const Text = Template.bind({});
