import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { PaginationStorybookComponent } from './pagination-storybook.component';

export default {
  title: 'Components/Pagination',
  component: PaginationStorybookComponent,
  decorators: [moduleMetadata({ imports: [PaginationStorybookComponent] })],
  args: {
    totalPages: 10,
    siblingCount: 1,
    boundaryCount: 1,
    hideFirstLast: false,
    hidePreviousNext: false,
    renderAs: 'buttons',
    totalItems: 0,
    pageSize: 20,
    showJumpTo: false,
    localized: false,
    pageSizeSelect: false,
    surface: 'dark',
  },
  argTypes: {
    totalPages: { control: { type: 'range', min: 1, max: 500, step: 1 } },
    siblingCount: { control: { type: 'range', min: 0, max: 4, step: 1 } },
    boundaryCount: { control: { type: 'range', min: 0, max: 4, step: 1 } },
    hideFirstLast: { control: 'boolean' },
    hidePreviousNext: { control: 'boolean' },
    renderAs: { control: 'radio', options: ['buttons', 'links'] },
    totalItems: { control: { type: 'number', min: 0 } },
    pageSize: { control: { type: 'number', min: 1 } },
    showJumpTo: { control: 'boolean' },
    localized: { control: 'boolean' },
    pageSizeSelect: { control: 'boolean' },
    surface: { control: 'text' },
  },
} as Meta<PaginationStorybookComponent>;

type Story = StoryObj<PaginationStorybookComponent>;

export const Default: Story = {};

export const ManyPages: Story = {
  args: { totalPages: 200 },
  parameters: {
    docs: {
      description: {
        story: 'For large page counts, far pages collapse behind ellipses around the current page and each edge.',
      },
    },
  },
};

export const Minimal: Story = {
  args: { hideFirstLast: true },
  parameters: {
    docs: {
      description: {
        story: 'Drop the first/last jumps with `hideFirstLast` (or previous/next with `hidePreviousNext`).',
      },
    },
  },
};

export const WithRangeAndJump: Story = {
  args: { totalPages: 25, totalItems: 500, pageSize: 20, showJumpTo: true },
  parameters: {
    docs: {
      description: {
        story:
          'Opt into a "Showing X–Y of Z" readout by passing `totalItems` + `pageSize`, and a jump-to-page field with `showJumpTo` — handy for large result sets.',
      },
    },
  },
};

export const PageSizeSelect: Story = {
  args: { pageSizeSelect: true },
  parameters: {
    docs: {
      description: {
        story:
          'The Material-style controls row: `<et-page-size-select>` beside a `compact` paginator. It is a ' +
          'native `<select>` — a handful of numbers does not justify dragging the overlay runtime into every ' +
          'footer, and the platform picker is the better control on mobile. It is a separate component ' +
          'because page size is the app’s state, not the paginator’s: **changing the size does not reset ' +
          'the page**, since which page an item lands on depends on what you are paging. Here a ' +
          '`linkedSignal` sends it back to page 1, which is the usual answer.',
      },
    },
  },
};

export const Localized: Story = {
  args: { localized: true, totalPages: 25, totalItems: 500, pageSize: 20, showJumpTo: true },
  parameters: {
    docs: {
      description: {
        story:
          "Every built-in string — control `aria-label`s, the range readout and the jump-to label — comes from the paginator's label set. Localize it app-wide with `providePaginationLabels`, or per instance with the `labels` input (as here, in German).",
      },
    },
  },
};

export const Links: Story = {
  args: { renderAs: 'links', totalPages: 8 },
  parameters: {
    docs: {
      description: {
        story:
          'With `renderAs="links"` + a `urlForPage`, items render as crawlable `<a href>`s. Plain clicks are intercepted (no reload); ⌘/Ctrl/middle clicks open the URL as usual.',
      },
    },
  },
};
