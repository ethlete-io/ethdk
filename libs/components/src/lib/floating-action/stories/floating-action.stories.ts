import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { FloatingActionStorybookComponent } from './floating-action-storybook.component';

export default {
  title: 'Components/Floating action',
  component: FloatingActionStorybookComponent,
  decorators: [moduleMetadata({ imports: [FloatingActionStorybookComponent] })],
  args: { surface: 'dark', disabled: false },
  argTypes: { surface: { control: 'text' }, disabled: { control: 'boolean' } },
} as Meta<FloatingActionStorybookComponent>;

type Story = StoryObj<FloatingActionStorybookComponent>;

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Scroll the story. The Filter button starts in the flow, pins to the corner once its anchor scrolls ' +
          'away, and scales out once the results list has gone too - there is nothing left to filter. Clicking it ' +
          'applies and calls `scrollToTop()`, which targets the `etFloatingActionTop` heading.',
      },
    },
  },
};

export const Disabled: Story = {
  args: { disabled: true },
  parameters: {
    docs: {
      description: {
        story:
          '`disabled` keeps the trigger in the flow whatever the scroll position - for turning the behaviour off ' +
          'per breakpoint or per route without unwinding the markup.',
      },
    },
  },
};
