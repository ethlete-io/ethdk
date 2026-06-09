import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { GridDataStorybookComponent, GridMigrationStorybookComponent, GridStorybookComponent } from './components';

export default {
  title: 'Components/Grid',
  component: GridStorybookComponent,
  decorators: [moduleMetadata({ imports: [GridStorybookComponent] })],
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

export const MigrationScenarios: StoryObj<GridMigrationStorybookComponent> = {
  decorators: [moduleMetadata({ imports: [GridMigrationStorybookComponent] })],
  render: () => ({ template: '<et-sb-grid-migration />' }),
};

export const DataDrivenWidgets: StoryObj<GridDataStorybookComponent> = {
  decorators: [moduleMetadata({ imports: [GridDataStorybookComponent] })],
  render: () => ({ template: '<et-sb-grid-data />' }),
  parameters: {
    docs: {
      description: {
        story:
          'Each grid item carries typed data in its `GridItemConfig.data` field. ' +
          'Widget components receive data as a typed input — layout and data are stored together ' +
          'but managed independently. Click the ✎ button on any widget to edit its data inline.',
      },
    },
  },
};
