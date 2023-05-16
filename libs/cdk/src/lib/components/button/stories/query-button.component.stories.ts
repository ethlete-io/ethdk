/* eslint-disable @typescript-eslint/no-explicit-any */
import { Meta, Story } from '@storybook/angular';
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
  },
  args: {
    disabled: false,
    pressed: false,
    type: 'button',
  },
} as Meta<StorybookQueryButtonComponent>;

const Template: Story<StorybookQueryButtonComponent> = (args) => ({
  props: args,
});

export const Default = Template.bind({});
