import { Meta, Story } from '@storybook/angular';
import { ScrollableStorybookComponent } from './components';
import CustomMDXDocumentation from './scrollable.docs.mdx';

export default {
  title: 'Components/Scrollable',
  component: ScrollableStorybookComponent,
  argTypes: {
    stickyButtons: {
      control: {
        type: 'boolean',
      },
    },
    direction: {
      control: {
        type: 'select',
      },
      options: ['horizontal', 'vertical'],
    },
    itemSize: {
      control: {
        type: 'select',
      },
      options: ['auto', 'same'],
    },
    scrollableRole: {
      control: {
        type: 'text',
      },
    },
    scrollableClass: {
      control: {
        type: 'text',
      },
    },
    renderMasks: {
      control: {
        type: 'boolean',
      },
    },
    renderScrollbars: {
      control: {
        type: 'boolean',
      },
    },
    renderButtons: {
      control: {
        type: 'boolean',
      },
    },
    makeScrollable: {
      control: {
        type: 'boolean',
      },
      name: 'Make scrollable (Story only)',
    },
    cursorDragScroll: {
      control: {
        type: 'boolean',
      },
    },
  },
  args: {
    stickyButtons: false,
    direction: 'horizontal',
    itemSize: 'auto',
    scrollableRole: undefined,
    makeScrollable: true,
    scrollableClass: undefined,
    renderMasks: true,
    renderScrollbars: false,
    renderButtons: true,
    cursorDragScroll: true,
  },
  parameters: {
    docs: {
      page: CustomMDXDocumentation,
    },
  },
} as Meta<ScrollableStorybookComponent>;

const Template: Story<ScrollableStorybookComponent> = (args) => ({
  props: args,
});

export const Default = Template.bind({});

Default.args = {};
