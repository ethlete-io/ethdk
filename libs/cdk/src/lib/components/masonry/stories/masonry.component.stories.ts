/* eslint-disable @typescript-eslint/no-explicit-any */
import { Meta, Story } from '@storybook/angular';
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

const Template: Story<StorybookMasonryComponent> = (args) => ({
  props: args,
});

export const Default = Template.bind({});
