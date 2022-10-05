import { Meta, Story } from '@storybook/angular';
import { PaginationStorybookComponent } from './components';
import CustomMDXDocumentation from './pagination.docs.mdx';

export default {
  title: 'Components/Pagination',
  component: PaginationStorybookComponent,
  argTypes: {
    ariaLabel: {
      control: {
        type: 'text',
      },
    },
    headTitleTemplate: {
      control: {
        type: 'text',
      },
    },
    headFirstPageTitle: {
      control: {
        type: 'text',
      },
    },
    headAddCanonicalTag: {
      control: {
        type: 'boolean',
      },
    },
    totalPages: {
      control: {
        type: 'number',
      },
    },
  },
  args: {
    ariaLabel: 'Pagination',
    headAddCanonicalTag: false,
    headFirstPageTitle: null,
    headTitleTemplate: null,
    totalPages: 2,
    pageChangeScrollAnchor: null,
  },
  parameters: {
    docs: {
      page: CustomMDXDocumentation,
    },
  },
} as Meta<PaginationStorybookComponent>;

const Template: Story<PaginationStorybookComponent> = (args) => ({
  props: args,
});

export const Default = Template.bind({});

Default.args = {};
