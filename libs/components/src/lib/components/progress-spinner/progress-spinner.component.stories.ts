import { Meta, Story } from '@storybook/angular';
import { ProgressSpinnerComponent } from './progress-spinner.component';
import CustomMDXDocumentation from './progress-spinner.component.docs.mdx';

export default {
  title: 'Components/Progress Spinner',
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
  },
  args: {
    diameter: 100,
    strokeWidth: 10,
    mode: 'indeterminate',
    multiColor: false,
  },
  parameters: {
    docs: {
      page: CustomMDXDocumentation,
    },
  },
} as Meta<ProgressSpinnerComponent>;

const Template: Story<ProgressSpinnerComponent> = (args) => ({
  props: args,
});

export const Default = Template.bind({});

Default.args = {};
