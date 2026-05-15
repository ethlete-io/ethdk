import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { TabsStorybookComponent } from './components';

const COLOR_OPTIONS = ['brand', 'danger', 'success', 'warning', 'neutral'] as const;

export default {
  title: 'Components/Tabs/Tabs',
  component: TabsStorybookComponent,
  decorators: [moduleMetadata({ imports: [TabsStorybookComponent] })],
  args: {
    orientation: 'horizontal',
    variant: 'secondary',
    fit: 'content',
    divider: true,
    disabled: false,
    preserveContent: true,
    sessionMemoryKey: null,
    color: 'brand',
  },
  argTypes: {
    orientation: { control: 'radio', options: ['horizontal', 'vertical'] },
    variant: { control: 'radio', options: ['primary', 'secondary'] },
    fit: { control: 'radio', options: ['content', 'fill'] },
    divider: { control: 'boolean' },
    disabled: { control: 'boolean' },
    preserveContent: { control: 'boolean' },
    sessionMemoryKey: { control: 'text' },
    color: { control: 'select', options: COLOR_OPTIONS },
  },
} as Meta<TabsStorybookComponent>;

type Story = StoryObj<TabsStorybookComponent>;

export const Default: Story = {};

export const Vertical: Story = {
  args: {
    orientation: 'vertical',
  },
};

export const WithDisabledTabs: Story = {
  args: {
    disabled: true,
  },
};

export const LazyRendering: Story = {
  args: {
    preserveContent: false,
  },
};

export const SessionMemory: Story = {
  args: {
    sessionMemoryKey: 'storybook-tabs-session-memory',
  },
};
