import { Meta, StoryFn } from '@storybook/angular';
import { FLOATING_UI_PLACEMENTS } from '../../../../../utils';
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
      options: FLOATING_UI_PLACEMENTS,
    },
  },
  args: {
    placement: 'bottom',
  },
} as Meta<TooltipStorybookComponent>;

const Template: StoryFn<TooltipStorybookComponent> = (args) => ({
  props: args,
});

export const Default = {
  render: Template,
  args: {},
};
