/* eslint-disable @typescript-eslint/no-explicit-any */
import { Meta, moduleMetadata, Story } from '@storybook/angular';
import { provideValidatorErrorsService } from '../../../services';
import { StorybookTextareaInputComponent } from './components/textarea-input-storybook.component';
import CustomMDXDocumentation from './textarea-input.docs.mdx';

export default {
  title: 'Components/Forms/Input',
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

export const Textarea = Template.bind({});
