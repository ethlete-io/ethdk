import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { MasonryStorybookComponent } from './masonry-storybook.component';

export default {
  title: 'Components/Masonry',
  component: MasonryStorybookComponent,
  decorators: [moduleMetadata({ imports: [MasonryStorybookComponent] })],
  args: { columnWidth: 240, gap: 16, itemCount: 18, loadMore: false, surface: 'dark' },
  argTypes: {
    columnWidth: { control: { type: 'range', min: 120, max: 600, step: 10 } },
    gap: { control: { type: 'range', min: 0, max: 64, step: 2 } },
    itemCount: { control: { type: 'range', min: 1, max: 60, step: 1 } },
    loadMore: { control: 'boolean' },
    surface: { control: 'text' },
  },
} as Meta<MasonryStorybookComponent>;

type Story = StoryObj<MasonryStorybookComponent>;

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Cards of differing heights, each going to whichever column is shortest. `columnWidth` is a ' +
          'minimum, so dragging it changes the column *count* — and narrowing the preview pane does the same, ' +
          'since the count comes from the container rather than a media query. Clicking a card grows it and ' +
          'the cards below it move down, which is the per-item measurement at work.',
      },
    },
  },
};

export const NarrowColumns: Story = {
  args: { columnWidth: 140, gap: 8, itemCount: 30 },
  parameters: {
    docs: {
      description: {
        story:
          'A denser grid. The packing is greedy and prefix-stable, so the more columns there are the more ' +
          'evenly the ragged bottom edge lands.',
      },
    },
  },
};

export const AppendingItems: Story = {
  args: { loadMore: true, itemCount: 12 },
  parameters: {
    docs: {
      description: {
        story:
          'What an infinite scroll does. **Load more** is disabled until `isSettled()` — the signal that ' +
          "replaces cdk's `injectInfinityQueryResponseDelay` handshake, and the one to gate a fetch on. Note " +
          'that appending never disturbs the cards already placed: where an item lands depends only on the ' +
          'items before it, so the existing placements are re-derived identically.',
      },
    },
  },
};

export const SingleColumn: Story = {
  args: { columnWidth: 4000, itemCount: 6 },
  parameters: {
    docs: {
      description: {
        story:
          'A column minimum wider than the container still lays out — one column, items stacked with the gap ' +
          'between them. Worth checking because it is what a masonry collapses to on a phone.',
      },
    },
  },
};
