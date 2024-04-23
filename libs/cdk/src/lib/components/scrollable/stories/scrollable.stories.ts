import { Meta, StoryFn } from '@storybook/angular';
import { ScrollableStorybookComponent } from './components';
import CustomMDXDocumentation from './scrollable.docs.mdx';

export default {
  title: 'CDK/Scrollable',
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
      options: ['auto', 'same', 'full'],
    },
    scrollableRole: {
      control: {
        type: 'text',
      },
    },
    scrollMode: {
      control: {
        type: 'select',
      },
      options: ['container', 'element'],
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
    renderNavigation: {
      control: {
        type: 'boolean',
      },
    },
    buttonPosition: {
      control: {
        type: 'select',
      },
      options: ['inside', 'footer'],
    },
    scrollOrigin: {
      control: {
        type: 'select',
      },
      options: ['auto', 'center', 'start', 'end'],
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
    snap: {
      control: {
        type: 'boolean',
      },
    },
    scrollMargin: {
      control: {
        type: 'number',
      },
    },
    disableActiveElementScrolling: {
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
    scrollOrigin: 'auto',
    renderMasks: true,
    renderScrollbars: false,
    renderButtons: true,
    cursorDragScroll: true,
    disableActiveElementScrolling: false,
    scrollMode: 'container',
    snap: false,
    scrollMargin: 0,
    renderNavigation: false,
    buttonPosition: 'inside',
  },
  parameters: {
    docs: {
      page: CustomMDXDocumentation,
    },
  },
} as Meta<ScrollableStorybookComponent>;

const Template: StoryFn<ScrollableStorybookComponent> = (args) => ({
  props: args,
});

export const Default = {
  render: Template,
  args: {},
};
