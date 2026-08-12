import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { QueryErrorStorybookComponent } from './query-error-storybook.component';

export default {
  title: 'Components/Feedback/Query error',
  component: QueryErrorStorybookComponent,
  decorators: [moduleMetadata({ imports: [QueryErrorStorybookComponent] })],
  args: { surface: 'dark', shape: 'message', alwaysAllowRetry: false, withSlots: false },
  argTypes: {
    surface: { control: 'text' },
    shape: {
      control: 'select',
      options: ['message', 'violations', 'classValidator', 'retryable', 'empty', 'echoesTitle'],
    },
    alwaysAllowRetry: { control: 'boolean' },
    withSlots: { control: 'boolean' },
  },
} as Meta<QueryErrorStorybookComponent>;

type Story = StoryObj<QueryErrorStorybookComponent>;

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'A single-message error. Switch `shape` to see the other response shapes the query client normalizes, ' +
          'and the locale button to see the German strings - the titles and fallback messages come from the ' +
          'status tables in `@ethlete/query`, picked by `injectLocale()` rather than an input.',
      },
    },
  },
};

export const ViolationList: Story = {
  args: { shape: 'violations' },
  parameters: {
    docs: {
      description: {
        story: 'A Symfony violation list renders as a list. So does a class-validator array (`classValidator`).',
      },
    },
  },
};

export const Retryable: Story = {
  args: { shape: 'retryable' },
  parameters: {
    docs: {
      description: {
        story:
          'A 503 is transient, so the retry policy says retry and the button appears. A 404 does not get one - ' +
          "offering to try again on a failure that cannot resolve itself wastes the reader's time. Set " +
          '`alwaysAllowRetry` to override that per instance.',
      },
    },
  },
};

export const EmptyBody: Story = {
  args: { shape: 'empty' },
  parameters: {
    docs: {
      description: {
        story:
          "A 500 with no body. The message comes from the status table rather than from Angular's raw " +
          '`HttpErrorResponse.message` ("Http failure response for /api/teams/42: 500 Error"), which is ' +
          'developer text and should never reach a reader.',
      },
    },
  },
};

export const CustomSlots: Story = {
  args: { shape: 'message', withSlots: true },
  parameters: {
    docs: {
      description: {
        story:
          'The same error twice: default, then with `etQueryErrorTitle` and `etQueryErrorActions` replaced. The ' +
          'error is in scope in both slots, so the wording can key off the status.',
      },
    },
  },
};
