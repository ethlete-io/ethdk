/* eslint-disable @typescript-eslint/no-explicit-any */
import { Meta, Story } from '@storybook/angular';
import { StorybookQueryButtonComponent } from './components';
import CustomMDXDocumentation from './query-button.docs.mdx';

export default {
  title: 'Components/Buttons',
  component: StorybookQueryButtonComponent,
  parameters: {
    docs: {
      page: CustomMDXDocumentation,
    },
  },
} as Meta<StorybookQueryButtonComponent>;

const Template: Story<StorybookQueryButtonComponent> = (args) => ({
  props: args,
});

export const QueryButton = Template.bind({});
