import { placements } from '@popperjs/core';
import { Meta, Story } from '@storybook/angular';
import { TooltipStorybookComponent } from './components';
import CustomMDXDocumentation from './tooltip.docs.mdx';

export default {
  title: 'CDK/Overlay/Tooltip',
  component: TooltipStorybookComponent,
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
      options: placements,
    },
  },
  args: {
    placement: 'auto',
  },
} as Meta<TooltipStorybookComponent>;

const Template: Story<TooltipStorybookComponent> = (args) => ({
  props: args,
});

export const Default = Template.bind({});

Default.args = {};
