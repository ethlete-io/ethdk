import { Meta, StoryFn } from '@storybook/angular';
import CustomMDXDocumentation from './carousel.docs.mdx';
import { StorybookCarouselComponent } from './components';

export default {
  title: 'CDK/Carousel',
  component: StorybookCarouselComponent,
  parameters: {
    docs: {
      page: CustomMDXDocumentation,
    },
  },
  argTypes: {
    loop: {
      control: {
        type: 'boolean',
      },
    },
    autoPlay: {
      control: {
        type: 'boolean',
      },
    },
    autoPlayTime: {
      control: {
        type: 'number',
      },
    },
    pauseAutoPlayOnHover: {
      control: {
        type: 'boolean',
      },
    },
    pauseAutoPlayOnFocus: {
      control: {
        type: 'boolean',
      },
    },
    transitionDuration: {
      control: {
        type: 'number',
      },
    },
    transitionType: {
      control: {
        type: 'select',
      },
      options: ['mask-slide'],
    },
    secondItemAutoPlayTime: {
      control: {
        type: 'number',
      },
    },
  },
  args: {
    loop: true,
    autoPlay: false,
    autoPlayTime: 5000,
    pauseAutoPlayOnHover: true,
    pauseAutoPlayOnFocus: true,
    transitionType: 'mask-slide',
    transitionDuration: 450,
    secondItemAutoPlayTime: 20000,
  },
} as Meta<StorybookCarouselComponent>;

const Template: StoryFn<StorybookCarouselComponent> = (args) => ({
  props: args,
});

export const Default = {
  render: Template,
};
