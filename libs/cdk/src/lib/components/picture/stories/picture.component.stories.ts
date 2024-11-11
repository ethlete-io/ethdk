import { Meta, StoryFn } from '@storybook/angular';
import { StorybookPictureComponent } from './components';
import CustomMDXDocumentation from './picture.docs.mdx';

export default {
  title: 'CDK/Picture',
  component: StorybookPictureComponent,
  parameters: {
    docs: {
      page: CustomMDXDocumentation,
    },
  },
  argTypes: {
    defaultSrc: {
      control: {
        type: 'text',
      },
    },
    alt: {
      control: {
        type: 'text',
      },
    },
    hasPriority: {
      control: {
        type: 'boolean',
      },
    },
    width: {
      control: {
        type: 'number',
      },
    },
    height: {
      control: {
        type: 'number',
      },
    },
  },
  args: {
    defaultSrc: 'https://picsum.photos/seed/picsum/600/300',
    alt: 'Picture name',
    hasPriority: false,
    width: 600,
    height: 300,
  },
} as Meta<StorybookPictureComponent>;

const Template: StoryFn<StorybookPictureComponent> = (args) => ({
  props: args,
});

export const Default = {
  render: Template,
};
