import { Meta, StoryFn } from '@storybook/angular';
import { StorybookMasonryComponent } from './components';
import CustomMDXDocumentation from './masonry.docs.mdx';

export default {
  title: 'CDK/Masonry',
  component: StorybookMasonryComponent,
  parameters: {
    docs: {
      page: CustomMDXDocumentation,
    },
  },
  argTypes: {
    gap: {
      control: {
        type: 'number',
      },
    },
    columWidth: {
      control: {
        type: 'number',
      },
    },
  },
  args: {
    gap: 16,
    columWidth: 200,
  },
} as Meta<StorybookMasonryComponent>;

const Template: StoryFn<StorybookMasonryComponent> = (args) => ({
  props: args,
});

export const Default = {
  render: Template,
};
