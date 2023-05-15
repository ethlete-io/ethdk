/* eslint-disable @typescript-eslint/no-explicit-any */
import { Meta, moduleMetadata, Story } from '@storybook/angular';
import { provideValidatorErrorsService } from '../../../../../services';
import { StorybookSelectComponent } from './components';
import CustomMDXDocumentation from './select.docs.mdx';

export default {
  title: 'CDK/Forms/Select/Select',
  component: StorybookSelectComponent,
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
  argTypes: {},
  args: {},
} as Meta<StorybookSelectComponent>;

const Template: Story<StorybookSelectComponent> = (args) => ({
  props: args,
});

export const Default = Template.bind({});
