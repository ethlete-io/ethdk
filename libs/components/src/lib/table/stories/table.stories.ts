import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { TableStorybookComponent } from './table-storybook.component';

export default {
  title: 'Components/Table',
  component: TableStorybookComponent,
  decorators: [moduleMetadata({ imports: [TableStorybookComponent] })],
  args: {
    rowCount: 6,
    constrainHeight: false,
    empty: false,
    multiSort: false,
    expandable: false,
    reorderable: false,
    surface: 'dark',
  },
  argTypes: {
    rowCount: { control: { type: 'range', min: 0, max: 40, step: 1 } },
    constrainHeight: { control: 'boolean' },
    empty: { control: 'boolean' },
    multiSort: { control: 'boolean' },
    expandable: { control: 'boolean' },
    reorderable: { control: 'boolean' },
    surface: { control: 'text' },
  },
} as Meta<TableStorybookComponent>;

type Story = StoryObj<TableStorybookComponent>;

export const Default: Story = {};

export const MultiSort: Story = {
  args: { multiSort: true },
  parameters: {
    docs: {
      description: {
        story: 'With `multiSort`, clicking successive headers layers sorts; each header cycles asc → desc → off.',
      },
    },
  },
};

export const StickyHeader: Story = {
  args: { rowCount: 40, constrainHeight: true },
  parameters: {
    docs: {
      description: {
        story: 'A height-constrained table scrolls its body while the header stays pinned (`position: sticky`).',
      },
    },
  },
};

export const Empty: Story = {
  args: { empty: true },
};

export const Expandable: Story = {
  args: { expandable: true },
  parameters: {
    docs: {
      description: {
        story: 'Rows expand to a lazily-instantiated detail row (nest another `<et-table>` here for sub-tables).',
      },
    },
  },
};

export const Reorderable: Story = {
  args: { reorderable: true },
  parameters: {
    docs: { description: { story: 'Drag a column header sideways to reorder columns.' } },
  },
};
