import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { TableStorybookComponent } from './table-storybook.component';

export default {
  title: 'Components/Table',
  component: TableStorybookComponent,
  decorators: [moduleMetadata({ imports: [TableStorybookComponent] })],
  args: {
    rowCount: 6,
    appearance: 'enclosed',
    density: 'comfortable',
    constrainHeight: false,
    empty: false,
    multiSort: false,
    expandable: false,
    reorderable: false,
    virtualScroll: false,
    grouped: false,
    surface: 'dark',
  },
  argTypes: {
    rowCount: { control: { type: 'range', min: 0, max: 40, step: 1 } },
    appearance: { control: 'inline-radio', options: ['enclosed', 'divided', 'zebra', 'grid', 'bare'] },
    density: { control: 'inline-radio', options: ['comfortable', 'compact', 'spacious'] },
    constrainHeight: { control: 'boolean' },
    empty: { control: 'boolean' },
    multiSort: { control: 'boolean' },
    expandable: { control: 'boolean' },
    reorderable: { control: 'boolean' },
    virtualScroll: { control: 'boolean' },
    grouped: { control: 'boolean' },
    surface: { control: 'text' },
  },
} as Meta<TableStorybookComponent>;

type Story = StoryObj<TableStorybookComponent>;

export const Default: Story = {};

export const Appearance: Story = {
  args: { appearance: 'zebra' },
  parameters: {
    docs: {
      description: {
        story:
          'The `appearance` input picks the frame: `enclosed` (default, bordered rounded panel), `divided`, ' +
          '`zebra`, `grid`, or `bare`. Switch it in the controls to compare.',
      },
    },
  },
};

export const Density: Story = {
  args: { density: 'compact' },
  parameters: {
    docs: {
      description: { story: '`density` sets the cell padding: `comfortable` (default), `compact`, `spacious`.' },
    },
  },
};

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

export const GroupedHeaders: Story = {
  args: { grouped: true },
  parameters: {
    docs: {
      description: {
        story:
          'Columns sharing a `group` render beneath one spanning label in a second header row; each ' +
          'sub-column stays independently sortable. Ungrouped columns (Name) span both header rows.',
      },
    },
  },
};

export const Virtualized: Story = {
  args: { virtualScroll: true },
  parameters: {
    docs: {
      description: {
        story:
          'With `virtualScroll`, the table becomes its own scroll container and renders only the rows near ' +
          'the viewport — here 2,000 rows scroll smoothly with a handful in the DOM. Give the table a bounded height.',
      },
    },
  },
};
