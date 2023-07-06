import { Meta, Story } from '@storybook/angular';
import { QueryErrorStorybookComponent } from './components';
import CustomMDXDocumentation from './query-error.docs.mdx';

export default {
  title: 'CDK/Query Error',
  component: QueryErrorStorybookComponent,
  argTypes: {
    error: {
      control: {
        type: 'object',
      },
    },
  },
  args: {
    error: {
      detail: {
        message: 'This is a test error',
      },
      status: 400,
      statusText: 'Bad request',
      url: 'https://example.com',
    },
  },
  parameters: {
    docs: {
      page: CustomMDXDocumentation,
    },
  },
} as Meta<QueryErrorStorybookComponent>;

const Template: Story<QueryErrorStorybookComponent> = (args) => ({
  props: args,
});

export const Default = Template.bind({});

Default.args = {};

export const MultipleErrors = Template.bind({});

MultipleErrors.args = {
  error: {
    detail: {
      statusCode: 400,
      error: 'Bad Request',
      message: ['This is a test error', 'An other test error', 'And a third one'],
    },
    status: 400,
    statusText: 'Bad request',
    url: 'https://example.com',
  },
};

export const RetryableError = Template.bind({});

RetryableError.args = {
  error: {
    detail: {
      message: 'Internal server error',
    },
    status: 500,
    statusText: 'Internal server error',
    url: 'https://example.com',
  },
};
