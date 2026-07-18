import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { SelectOptionGroupStorybookComponent } from './select-option-group-storybook.component';

export default {
  title: 'Components/Forms/Select option group',
  component: SelectOptionGroupStorybookComponent,
  decorators: [moduleMetadata({ imports: [SelectOptionGroupStorybookComponent] })],
  argTypes: {
    label: { control: 'text' },
    hint: { control: 'text' },
    placeholder: { control: 'text' },
    withSearch: { control: 'boolean' },
    color: { control: 'select', options: ['brand', 'danger', 'success', 'warning', 'neutral'] },
  },
  args: {
    label: 'Player',
    hint: '',
    placeholder: 'Pick a player',
    withSearch: false,
    color: 'brand',
  },
} as Meta<SelectOptionGroupStorybookComponent>;

type Story = StoryObj<SelectOptionGroupStorybookComponent>;

export const Default: Story = {};

export const WithSearch: Story = {
  args: { withSearch: true, hint: 'Empty groups hide as you filter' },
};
