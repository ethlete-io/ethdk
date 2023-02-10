/* eslint-disable @typescript-eslint/no-explicit-any */
import { Meta, Story } from '@storybook/angular';
import CustomMDXDocumentation from './button.docs.mdx';
import { StorybookButtonComponent } from './components';

export default {
  title: 'Components/Buttons',
  component: StorybookButtonComponent,
  parameters: {
    docs: {
      page: CustomMDXDocumentation,
    },
  },
} as Meta<StorybookButtonComponent>;

const Template: Story<StorybookButtonComponent> = (args) => ({
  props: args,
});

export const Button = Template.bind({});
