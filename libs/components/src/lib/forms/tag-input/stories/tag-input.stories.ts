import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { TagInputStorybookComponent } from './tag-input-storybook.component';

export default {
  title: 'Components/Forms/Tag Input',
  component: TagInputStorybookComponent,
  decorators: [moduleMetadata({ imports: [TagInputStorybookComponent] })],
  argTypes: {
    appearance: { control: 'select', options: ['box', 'underline'] },
    fill: { control: 'select', options: ['transparent', 'filled'] },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
    label: { control: 'text' },
    placeholder: { control: 'text' },
    hint: { control: 'text' },
    mixed: { control: 'boolean' },
    mixedLabel: { control: 'text' },
    showMixedState: { control: false, table: { disable: true } },
    allowDuplicates: { control: 'boolean' },
    maxTags: { control: 'number' },
    disabled: { control: 'boolean' },
    readonly: { control: 'boolean' },
    color: { control: 'select', options: ['brand', 'danger', 'success', 'warning', 'neutral'] },
  },
  args: {
    appearance: 'box',
    fill: 'transparent',
    size: 'md',
    label: 'Tags',
    placeholder: 'Add a tag…',
    hint: 'Enter or comma commits a tag',
    mixed: false,
    mixedLabel: 'Mixed',
    showMixedState: false,
    allowDuplicates: false,
    disabled: false,
    readonly: false,
    color: 'brand',
  },
} as Meta<TagInputStorybookComponent>;

type Story = StoryObj<TagInputStorybookComponent>;

export const Default: Story = {};

export const Prefilled: Story = {
  args: { value: ['angular', 'signals'] },
};

export const Mixed: Story = {
  args: {
    value: ['angular', 'signals'],
    mixed: true,
    mixedLabel: 'Mixed tags',
    showMixedState: true,
    hint: 'The hidden tag set stays intact until the first committed tag starts a fresh set.',
  },
};

export const MaxTags: Story = {
  args: { value: ['one', 'two'], maxTags: 3, hint: 'At most 3 tags' },
};
