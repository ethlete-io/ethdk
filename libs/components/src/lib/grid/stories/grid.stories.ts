import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { provideGridConfig } from '../headless/grid-config';
import { GridDataStorybookComponent, GridPartnerStorybookComponent, GridStorybookComponent } from './components';
import { DummyChartComponent, DummyTableComponent, DummyTextComponent } from './components/dummy-components';

export default {
  title: 'Components/Grid',
  component: GridStorybookComponent,
  decorators: [
    moduleMetadata({
      imports: [GridStorybookComponent],
      providers: [
        ...provideGridConfig({
          registrations: [
            {
              type: 'chart',
              component: DummyChartComponent,
              constraints: { minColSpan: 3, maxColSpan: 12, minRowSpan: 2, maxRowSpan: 4 },
            },
            {
              type: 'table',
              component: DummyTableComponent,
              constraints: { minColSpan: 2, maxColSpan: 12, minRowSpan: 2, maxRowSpan: 4 },
            },
            {
              type: 'text',
              component: DummyTextComponent,
              constraints: { minColSpan: 2, maxColSpan: 12, minRowSpan: 1, maxRowSpan: 4 },
            },
          ],
        }),
      ],
    }),
  ],
  args: {
    rowHeight: 100,
    gap: 16,
    readOnly: false,
  },
  argTypes: {
    rowHeight: { control: { type: 'range', min: 50, max: 300, step: 10 } },
    gap: { control: { type: 'range', min: 0, max: 48, step: 4 } },
    readOnly: { control: 'boolean' },
  },
} as Meta<GridStorybookComponent>;

type Story = StoryObj<GridStorybookComponent>;

export const Default: Story = {};

export const ReadOnly: Story = {
  args: {
    readOnly: true,
  },
};

export const CompactGrid: Story = {
  args: {
    rowHeight: 80,
    gap: 8,
  },
};

export const LargeItems: Story = {
  args: {
    rowHeight: 150,
    gap: 24,
  },
};

export const SixColumnGrid: Story = {
  args: {
    breakpoints: [
      { name: 'lg', columns: 6, minWidth: 900 },
      { name: 'md', columns: 3, minWidth: 500 },
      { name: 'sm', columns: 1, minWidth: 0 },
    ],
  },
};

export const PartnerDashboard: StoryObj<GridPartnerStorybookComponent> = {
  decorators: [moduleMetadata({ imports: [GridPartnerStorybookComponent] })],
  render: () => ({ template: '<et-sb-grid-real-world />' }),
  parameters: {
    docs: {
      description: {
        story:
          'Real-world dashboard layout with mixed widget types across three breakpoints. ' +
          'Widget types include: team, contacts, summary, text, attribute_list. ' +
          'Drag and resize widgets, then click **Show API Payload** to inspect the converted output.',
      },
    },
  },
};

export const BackendIntegration: StoryObj<GridDataStorybookComponent> = {
  decorators: [moduleMetadata({ imports: [GridDataStorybookComponent] })],
  render: () => ({ template: '<et-sb-grid-data />' }),
  parameters: {
    docs: {
      description: {
        story:
          'Demonstrates the adapter pattern for backend-integrated dashboards. ' +
          'Widget layout is stored per-breakpoint on the backend as `{x, y, cols, rows}` — ' +
          "a different shape from the grid's internal `{col, row, colSpan, rowSpan}`. " +
          '`createGridAdapter()` bridges the two: `fromExternal` maps backend widgets to ' +
          '`GridItemConfig[]` for the grid to render, and `toExternal` converts back to ' +
          'the API shape for `PATCH /partners/dashboard/:uuid`. ' +
          'Click **Show API Payload** after dragging, resizing, or adding widgets to inspect ' +
          'the exact JSON the adapter produces.',
      },
    },
  },
};
