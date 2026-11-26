import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { ChipStorybookComponent, FilterChipsStorybookComponent } from './chip-storybook.component';

export default {
  title: 'Components/Data display/Chip',
  component: ChipStorybookComponent,
  decorators: [moduleMetadata({ imports: [ChipStorybookComponent] })],
  argTypes: {
    disabled: { control: 'boolean' },
    removable: { control: 'boolean' },
  },
  args: { disabled: false, removable: true },
} as Meta<ChipStorybookComponent>;

type Story = StoryObj<ChipStorybookComponent>;

export const Default: Story = {};

export const NotRemovable: Story = {
  args: { removable: false },
};

export const Disabled: Story = {
  args: { disabled: true },
};

export const FilterChips: StoryObj<FilterChipsStorybookComponent> = {
  decorators: [moduleMetadata({ imports: [FilterChipsStorybookComponent] })],
  render: (args) => ({
    props: args,
    template: `<et-sb-filter-chips [readonly]="readonly" />`,
  }),
  argTypes: { readonly: { control: 'boolean' } },
  args: { readonly: false },
};
