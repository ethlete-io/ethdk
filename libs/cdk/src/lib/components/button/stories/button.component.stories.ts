import { Meta, StoryFn } from '@storybook/angular';
import CustomMDXDocumentation from './button.docs.mdx';
import { StorybookButtonComponent } from './components';

export default {
  title: 'CDK/Buttons/Button',
  component: StorybookButtonComponent,
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
  },
  args: {
    disabled: false,
    pressed: false,
    type: 'button',
  },
} as Meta<StorybookButtonComponent>;

const Template: StoryFn<StorybookButtonComponent> = (args) => ({
  props: args,
});

export const Default = {
  render: Template,
};
