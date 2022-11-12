import { Meta, moduleMetadata, Story } from '@storybook/angular';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { SortStorybookComponent } from './components';
import CustomMDXDocumentation from './sort.docs.mdx';

export default {
  title: 'Components/Sort',
  component: SortStorybookComponent,
  decorators: [
    moduleMetadata({
      imports: [BrowserAnimationsModule],
    }),
  ],
  argTypes: {
    arrowPosition: {
      control: {
        type: 'radio',
      },
      options: ['before', 'after'],
    },
    start: {
      control: {
        type: 'radio',
      },
      options: ['asc', 'desc', ''],
    },
    disableClear: {
      control: {
        type: 'boolean',
      },
    },
    sortActionDescription: {
      control: {
        type: 'text',
      },
    },
  },
  args: {
    arrowPosition: 'after',
    start: '',
    disableClear: false,
    sortActionDescription: 'Sort',
  },
  parameters: {
    docs: {
      page: CustomMDXDocumentation,
    },
  },
} as Meta<SortStorybookComponent>;

const Template: Story<SortStorybookComponent> = (args) => ({
  props: args,
});

export const Default = Template.bind({});

Default.args = {};
