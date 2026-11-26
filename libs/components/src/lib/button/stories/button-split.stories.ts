import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { SplitButtonStorybookComponent } from './components';

const COLOR_OPTIONS = ['brand', 'danger', 'success', 'warning', 'neutral', 'neutral-dark'] as const;

export default {
  title: 'Components/Actions/Button/Split',
  component: SplitButtonStorybookComponent,
  decorators: [moduleMetadata({ imports: [SplitButtonStorybookComponent] })],
  argTypes: {
    color: { control: 'select', options: COLOR_OPTIONS },
    disabled: { control: 'boolean' },
    loading: { control: 'boolean' },
    progress: { control: { type: 'number', min: 0, max: 100, step: 1 } },
  },
  args: { color: 'brand', disabled: false, loading: false, progress: undefined },
} as Meta<SplitButtonStorybookComponent>;

type Story = StoryObj<SplitButtonStorybookComponent>;

export const Default: Story = {};
