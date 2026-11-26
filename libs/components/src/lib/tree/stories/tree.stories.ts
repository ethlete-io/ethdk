import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { TreeStorybookComponent } from './tree-storybook.component';

export default {
  title: 'Components/Data display/Tree',
  component: TreeStorybookComponent,
  decorators: [moduleMetadata({ imports: [TreeStorybookComponent] })],
  args: { selectionMode: 'single', disabled: false, async: false, customRows: false },
  argTypes: { selectionMode: { control: 'inline-radio', options: ['none', 'single', 'multiple'] } },
} as Meta<TreeStorybookComponent>;

type Story = StoryObj<TreeStorybookComponent>;

export const Default: Story = {};

export const MultiSelect: Story = {
  args: { selectionMode: 'multiple' },
  parameters: {
    docs: {
      description: {
        story:
          '`selectionMode="multiple"` makes each row toggle its own selection, and `value` an array. Selections are independent - a branch is not implied by its children.',
      },
    },
  },
};

export const NavigationOnly: Story = {
  args: { selectionMode: 'none' },
  parameters: {
    docs: {
      description: {
        story:
          '`selectionMode="none"` keeps expansion, focus and the `nodeActivate` output but never selects - for a tree that navigates somewhere instead of holding a value.',
      },
    },
  },
};

export const LazyLoading: Story = {
  args: { async: true },
  parameters: {
    docs: {
      description: {
        story:
          'Every level takes 600ms to arrive, so a branch shows a spinner in place of its chevron while it loads. The `assets` branch always fails: it shows the message and reloads when the row is selected again.',
      },
    },
  },
};

export const CustomRows: Story = {
  args: { customRows: true },
  parameters: {
    docs: {
      description: {
        story: 'An `<ng-template etTreeNodeDef>` replaces the plain label - here with a per-file icon.',
      },
    },
  },
};

export const Disabled: Story = {
  args: { disabled: true },
  parameters: {
    docs: {
      description: {
        story: 'A disabled tree keeps its rows readable and reachable, but nothing expands or selects.',
      },
    },
  },
};
