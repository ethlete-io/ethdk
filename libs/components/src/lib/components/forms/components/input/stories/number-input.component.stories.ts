/* eslint-disable @typescript-eslint/no-explicit-any */
import { Meta, moduleMetadata, Story } from '@storybook/angular';
import { provideValidatorErrorsService } from '../../../services';
import { StorybookNumberInputComponent } from './components';
import CustomMDXDocumentation from './number-input.docs.mdx';

export default {
  title: 'Components/Forms/Input',
  component: StorybookNumberInputComponent,
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
} as Meta<StorybookNumberInputComponent>;

const Template: Story<StorybookNumberInputComponent> = (args) => ({
  props: args,
});

export const Number = Template.bind({});
