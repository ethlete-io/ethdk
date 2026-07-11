import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { SplitButtonStorybookComponent } from './components';

const COLOR_OPTIONS = ['brand', 'danger', 'success', 'warning', 'neutral', 'neutral-dark'] as const;

export default {
  title: 'Components/Button/Split',
  component: SplitButtonStorybookComponent,
  decorators: [moduleMetadata({ imports: [SplitButtonStorybookComponent] })],
  argTypes: {
    color: { control: 'select', options: COLOR_OPTIONS },
    disabled: { control: 'boolean' },
    loading: { control: 'boolean' },
  },
  args: { color: 'brand', disabled: false, loading: false },
} as Meta<SplitButtonStorybookComponent>;

type Story = StoryObj<SplitButtonStorybookComponent>;

export const Default: Story = {};
