/* eslint-disable @typescript-eslint/no-explicit-any */
import { Meta, moduleMetadata, Story } from '@storybook/angular';
import { provideValidatorErrorsService } from '../../../services';
import { StorybookSearchInputComponent } from './components';
import CustomMDXDocumentation from './search-input.docs.mdx';

export default {
  title: 'CDK/Forms/Input',
  component: StorybookSearchInputComponent,
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
} as Meta<StorybookSearchInputComponent>;

const Template: Story<StorybookSearchInputComponent> = (args) => ({
  props: args,
});

export const Search = Template.bind({});
