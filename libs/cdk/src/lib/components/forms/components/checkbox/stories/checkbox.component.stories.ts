/* eslint-disable @typescript-eslint/no-explicit-any */
import { Meta, moduleMetadata, Story } from '@storybook/angular';
import { provideValidatorErrorsService } from '../../../services';
import CustomMDXDocumentation from './checkbox.docs.mdx';
import { StorybookCheckboxComponent } from './components';

export default {
  title: 'CDK/Forms/Checkbox',
  component: StorybookCheckboxComponent,
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
} as Meta<StorybookCheckboxComponent>;

const Template: Story<StorybookCheckboxComponent> = (args) => ({
  props: args,
});

export const Default = Template.bind({});
