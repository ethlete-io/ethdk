import { Meta, StoryFn } from '@storybook/angular';
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

const Template: StoryFn<FilterOverlayHostStorybookComponent> = (args) => ({
  props: args,
});

export const Default = {
  render: Template,
  args: {},
};
