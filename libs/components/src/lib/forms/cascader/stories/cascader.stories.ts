import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { CascaderStorybookComponent } from './cascader-storybook.component';

export default {
  title: 'Components/Forms/Cascader',
  component: CascaderStorybookComponent,
  decorators: [moduleMetadata({ imports: [CascaderStorybookComponent] })],
  argTypes: {
    label: { control: 'text' },
    hint: { control: 'text' },
    placeholder: { control: 'text' },
    selectableLevels: { control: 'inline-radio', options: ['leaf', 'any'] },
    async: { control: 'boolean' },
    searchable: { control: 'boolean' },
    deep: { control: 'boolean' },
    multiple: { control: 'boolean' },
    errorMode: { control: 'boolean' },
    mixed: { control: 'boolean' },
    mixedLabel: { control: 'text' },
    showMixedState: { control: false, table: { disable: true } },
    color: { control: 'select', options: ['brand', 'danger', 'success', 'warning', 'neutral'] },
  },
  args: {
    label: 'Match',
    hint: '',
    placeholder: 'Browse competitions',
    selectableLevels: 'leaf',
    async: false,
    searchable: false,
    deep: false,
    multiple: false,
    errorMode: false,
    mixed: false,
    mixedLabel: 'Mixed',
    showMixedState: false,
    color: 'brand',
  },
} as Meta<CascaderStorybookComponent>;

type Story = StoryObj<CascaderStorybookComponent>;

export const Default: Story = {};

export const AnyLevel: Story = {
  args: { selectableLevels: 'any', hint: 'Any node - including a stage - can be committed' },
};

export const AsyncLevels: Story = {
  args: { async: true, hint: 'Each level loads on demand' },
};

export const Search: Story = {
  args: { searchable: true, hint: 'Type in the panel to search across all levels at once' },
};

export const Multiple: Story = {
  args: {
    multiple: true,
    hint: 'Leaf picks toggle - parents show the dash, or a full check once every child is picked',
  },
};

export const MultipleWithSearch: Story = {
  args: { multiple: true, searchable: true, hint: 'Toggle several results of one search' },
};

export const Mixed: Story = {
  args: {
    value: 'euro-final',
    mixed: true,
    mixedLabel: 'Different values',
    showMixedState: true,
    hint: 'The raw value stays intact until a user commits a new pick; Mixed shows the live presentation state.',
  },
};

export const MixedMultiple: Story = {
  args: {
    multiple: true,
    value: ['euro-group-a', 'wc-final'],
    mixed: true,
    mixedLabel: 'Different selections',
    showMixedState: true,
    hint: 'The first committed node replaces the hidden raw selection, then regular multi toggling resumes.',
  },
};

export const DeepNesting: Story = {
  args: {
    deep: true,
    placeholder: 'Browse players',
    hint: 'Past three levels, older columns collapse into the breadcrumb row',
  },
};

export const AsyncError: Story = {
  args: { errorMode: true, hint: 'The first load of each level fails - use Retry to recover' },
};
