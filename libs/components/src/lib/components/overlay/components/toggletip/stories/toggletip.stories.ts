import { placements } from '@popperjs/core';
import { Meta, Story } from '@storybook/angular';
import { ToggletipStorybookComponent } from './components';
import CustomMDXDocumentation from './toggletip.docs.mdx';

export default {
  title: 'Components/Overlay/Toggletip',
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
        options: placements,
      },
    },
    showToggletip: {
      control: {
        type: 'boolean',
      },
    },
  },
  args: {
    placement: 'auto',
  },
} as Meta<ToggletipStorybookComponent>;

const Template: Story<ToggletipStorybookComponent> = (args) => ({
  props: args,
});

export const Default = Template.bind({});

Default.args = {};
