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
    errorMode: { control: 'boolean' },
    color: { control: 'select', options: ['brand', 'danger', 'success', 'warning', 'neutral'] },
  },
  args: {
    label: 'Match',
    hint: '',
    placeholder: 'Browse competitions',
    selectableLevels: 'leaf',
    async: false,
    errorMode: false,
    color: 'brand',
  },
} as Meta<CascaderStorybookComponent>;

type Story = StoryObj<CascaderStorybookComponent>;

export const Default: Story = {};

export const AnyLevel: Story = {
  args: { selectableLevels: 'any', hint: 'Any node — including a stage — can be committed' },
};

export const AsyncLevels: Story = {
  args: { async: true, hint: 'Each level loads on demand' },
};

export const AsyncError: Story = {
  args: { errorMode: true, hint: 'The first load of each level fails — use Retry to recover' },
};
