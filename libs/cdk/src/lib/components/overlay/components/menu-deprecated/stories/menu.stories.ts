import { Meta, Story } from '@storybook/angular';
import { MenuStorybookComponent } from './components';
import CustomMDXDocumentation from './menu.docs.mdx';

export default {
  title: 'Deprecated/CDK/Overlay/Menu',
  component: MenuStorybookComponent,
  parameters: {
    docs: {
      page: CustomMDXDocumentation,
    },
  },
} as Meta<MenuStorybookComponent>;

const Template: Story<MenuStorybookComponent> = (args) => ({
  props: args,
});

export const Default = Template.bind({});

Default.args = {};
