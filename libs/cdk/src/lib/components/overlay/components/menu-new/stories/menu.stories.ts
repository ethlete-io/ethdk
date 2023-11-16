import { Meta, Story } from '@storybook/angular';
import { MenuStorybookComponent } from './components';
import CustomMDXDocumentation from './menu.docs.mdx';

export default {
  title: 'Experimental/CDK/Overlay/Menu (New)',
  component: MenuStorybookComponent,
  parameters: {
    docs: {
      page: CustomMDXDocumentation,
    },
  },
  argTypes: {},
} as Meta<MenuStorybookComponent>;

const Template: Story<MenuStorybookComponent> = (args) => ({
  props: args,
});

export const Default = Template.bind({});

Default.args = {};
