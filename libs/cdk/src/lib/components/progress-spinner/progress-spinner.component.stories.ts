import { Meta, StoryFn } from '@storybook/angular';
import { ProgressSpinnerComponent } from './progress-spinner.component';
import CustomMDXDocumentation from './progress-spinner.component.docs.mdx';

export default {
  title: 'CDK/Progress Spinner',
  component: ProgressSpinnerComponent,
  argTypes: {
    diameter: {
      control: { type: 'number' },
    },
    mode: {
      control: { type: 'select' },
      options: ['determinate', 'indeterminate'],
    },
    strokeWidth: {
      control: { type: 'number' },
    },
    value: {
      control: { type: 'number' },
    },
    multiColor: {
      control: { type: 'boolean' },
    },
    renderBackground: {
      control: { type: 'boolean' },
    },
  },
  args: {
    diameter: 100,
    strokeWidth: 10,
    mode: 'indeterminate',
    multiColor: false,
    renderBackground: false,
  },
  parameters: {
    docs: {
      page: CustomMDXDocumentation,
    },
  },
} as Meta<ProgressSpinnerComponent>;

const Template: StoryFn<ProgressSpinnerComponent> = (args) => ({
  props: args,
});

export const Default = {
  render: Template,
  args: {},
};
