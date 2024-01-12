import { Meta, Story } from '@storybook/angular';
import { FilterOverlayHostStorybookComponent } from './components';
import CustomMDXDocumentation from './filter-overlay.docs.mdx';

export default {
  title: 'CDK/Filters/Filter Overlay',
  component: FilterOverlayHostStorybookComponent,
  argTypes: {},
  args: {},
  parameters: {
    docs: {
      page: CustomMDXDocumentation,
    },
  },
} as Meta<FilterOverlayHostStorybookComponent>;

const Template: Story<FilterOverlayHostStorybookComponent> = (args) => ({
  props: args,
});

export const Default = Template.bind({});

Default.args = {};
