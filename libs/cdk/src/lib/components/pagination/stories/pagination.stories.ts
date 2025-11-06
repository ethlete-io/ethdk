import { Meta, StoryFn } from '@storybook/angular';
import { PaginationStorybookComponent } from './components';
import CustomMDXDocumentation from './pagination.docs.mdx';

export default {
  title: 'CDK/Pagination',
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

const Template: StoryFn<PaginationStorybookComponent> = (args) => ({
  props: args,
});

export const Default = {
  render: Template,
  args: {},
};
