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
    surface: 'dark',
  },
  argTypes: {
    totalPages: { control: { type: 'range', min: 1, max: 500, step: 1 } },
    siblingCount: { control: { type: 'range', min: 0, max: 4, step: 1 } },
    boundaryCount: { control: { type: 'range', min: 0, max: 4, step: 1 } },
    hideFirstLast: { control: 'boolean' },
    hidePreviousNext: { control: 'boolean' },
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
