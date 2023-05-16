/* eslint-disable @typescript-eslint/no-explicit-any */
import { applicationConfig, Meta, Story } from '@storybook/angular';
import { provideValidatorErrorsService } from '../../../../../services';
import { StorybookSelectComponent } from './components';
import CustomMDXDocumentation from './select.docs.mdx';

export default {
  title: 'CDK/Forms/Select/Select',
  component: StorybookSelectComponent,
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
  argTypes: {
    emptyText: {
      control: {
        type: 'text',
      },
    },
    multiple: {
      control: {
        type: 'boolean',
      },
    },
  },
  args: {
    multiple: true,
  },
} as Meta<StorybookSelectComponent>;

const Template: Story<StorybookSelectComponent> = (args) => ({
  props: args,
});

export const Default = Template.bind({});
