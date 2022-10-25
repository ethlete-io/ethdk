import { Meta, Story } from '@storybook/angular';
import { ScrollableStorybookComponent } from './components';
import CustomMDXDocumentation from './scrollable.docs.mdx';

export default {
  title: 'Components/Scrollable',
  component: ScrollableStorybookComponent,
  // argTypes: {
  //   ariaLabel: {
  //     control: {
  //       type: 'text',
  //     },
  //   },
  //   headTitleTemplate: {
  //     control: {
  //       type: 'text',
  //     },
  //   },
  //   headFirstPageTitle: {
  //     control: {
  //       type: 'text',
  //     },
  //   },
  //   headAddCanonicalTag: {
  //     control: {
  //       type: 'boolean',
  //     },
  //   },
  //   totalPages: {
  //     control: {
  //       type: 'number',
  //     },
  //   },
  // },
  // args: {
  //   ariaLabel: 'Pagination',
  //   headAddCanonicalTag: false,
  //   headFirstPageTitle: null,
  //   headTitleTemplate: null,
  //   totalPages: 2,
  //   pageChangeScrollAnchor: null,
  // },
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
