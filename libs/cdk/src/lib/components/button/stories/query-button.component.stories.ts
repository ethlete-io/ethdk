import { Meta, StoryFn } from '@storybook/angular';
import { StorybookQueryButtonComponent } from './components';
import CustomMDXDocumentation from './query-button.docs.mdx';

export default {
  title: 'CDK/Buttons/Query Button',
  component: StorybookQueryButtonComponent,
  parameters: {
    docs: {
      page: CustomMDXDocumentation,
    },
  },
  argTypes: {
    disabled: {
      control: {
        type: 'boolean',
      },
    },
    pressed: {
      control: {
        type: 'boolean',
      },
    },
    type: {
      control: {
        type: 'select',
      },
      options: ['button', 'submit', 'reset', 'menu'],
    },
    skipSuccess: {
      control: {
        type: 'boolean',
      },
    },
    skipFailure: {
      control: {
        type: 'boolean',
      },
    },
    skipLoading: {
      control: {
        type: 'boolean',
      },
    },
  },
  args: {
    disabled: false,
    pressed: false,
    type: 'button',
    skipFailure: false,
    skipLoading: false,
    skipSuccess: false,
  },
} as Meta<StorybookQueryButtonComponent>;

const Template: StoryFn<StorybookQueryButtonComponent> = (args) => ({
  props: args,
});

export const Default = {
  render: Template,
};
