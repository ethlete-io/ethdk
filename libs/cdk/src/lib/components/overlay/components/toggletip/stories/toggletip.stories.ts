import { Meta, StoryFn } from '@storybook/angular';
import { FLOATING_UI_PLACEMENTS } from '../../../../../utils';
import { ToggletipStorybookComponent } from './components';
import CustomMDXDocumentation from './toggletip.docs.mdx';

export default {
  title: 'CDK/Overlay/Toggletip',
  component: ToggletipStorybookComponent,
  parameters: {
    docs: {
      page: CustomMDXDocumentation,
    },
  },
  argTypes: {
    placement: {
      control: {
        type: 'select',
      },
      options: FLOATING_UI_PLACEMENTS,
    },
    showToggletip: {
      control: {
        type: 'boolean',
      },
    },
  },
  args: {
    placement: 'bottom',
  },
} as Meta<ToggletipStorybookComponent>;

const Template: StoryFn<ToggletipStorybookComponent> = (args) => ({
  props: args,
});

export const Default = {
  render: Template,
  args: {},
};
