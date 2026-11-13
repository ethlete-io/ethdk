import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { TabsStorybookComponent } from './components';

const COLOR_OPTIONS = ['brand', 'danger', 'success', 'warning', 'neutral'] as const;

export default {
  title: 'Components/Navigation/Tabs/Tabs',
  component: TabsStorybookComponent,
  decorators: [moduleMetadata({ imports: [TabsStorybookComponent] })],
  args: {
    orientation: 'horizontal',
    variant: 'secondary',
    fit: 'content',
    align: 'start',
    tokens: null,
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
    align: { control: 'radio', options: ['start', 'center', 'end'] },
    tokens: { control: 'object' },
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

export const Centered: Story = {
  args: {
    align: 'center',
  },
};

export const RestyledWithTokens: Story = {
  args: {
    tokens: {
      '--et-tab-font-weight': '700',
      '--et-tab-text-transform': 'uppercase',
      '--et-tab-letter-spacing': '0.12em',
      '--et-tab-line-height': '1',
      '--et-tab-underline-size': '4px',
      '--et-tab-baseline-size': '1px',
      '--et-tab-hover-color': 'var(--et-surface-color-solid)',
      '--et-tab-hover-underline-opacity': '1',
    },
  },
};
