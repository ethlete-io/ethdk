import { Meta, StoryFn } from '@storybook/angular';
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

const Template: StoryFn<MenuStorybookComponent> = (args) => ({
  props: args,
});

export const Default = {
  render: Template,
  args: {},
};
