import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { ScrollableStorybookComponent } from './components';

export default {
  title: 'Components/Scrollable',
  component: ScrollableStorybookComponent,
  decorators: [moduleMetadata({ imports: [ScrollableStorybookComponent] })],
  argTypes: {
    color: {
      control: { type: 'select' },
      options: [null, 'brand', 'danger', 'success', 'warning', 'neutral'],
    },
    stickyButtons: {
      control: { type: 'boolean' },
    },
    direction: {
      control: { type: 'select' },
      options: ['horizontal', 'vertical'],
    },
    itemSize: {
      control: { type: 'select' },
      options: ['auto', 'same', 'half', 'third', 'quarter', 'full'],
    },
    scrollableRole: {
      control: { type: 'text' },
    },
    scrollableClass: {
      control: { type: 'text' },
    },
    scrollMode: {
      control: { type: 'select' },
      options: ['container', 'element'],
    },
    renderMasks: {
      control: { type: 'boolean' },
    },
    maskVariant: {
      control: { type: 'select' },
      options: ['gradient', 'border'],
    },
    renderNavigation: {
      control: { type: 'boolean' },
    },
    buttonPosition: {
      control: { type: 'select' },
      options: ['inside', 'footer'],
    },
    scrollOrigin: {
      control: { type: 'select' },
      options: ['auto', 'center', 'start', 'end'],
    },
    renderScrollbars: {
      control: { type: 'boolean' },
    },
    renderButtons: {
      control: { type: 'boolean' },
    },
    cursorDragScroll: {
      control: { type: 'boolean' },
    },
    snap: {
      control: { type: 'boolean' },
    },
    scrollMargin: {
      control: { type: 'number' },
    },
    darkenNonIntersectingItems: {
      control: { type: 'boolean' },
    },
  },
  args: {
    color: null,
    stickyButtons: false,
    direction: 'horizontal',
    itemSize: 'auto',
    scrollableRole: undefined,
    scrollableClass: undefined,
    scrollOrigin: 'auto',
    renderMasks: true,
    maskVariant: 'gradient',
    renderScrollbars: false,
    renderButtons: true,
    cursorDragScroll: true,
    scrollMode: 'container',
    snap: false,
    scrollMargin: 0,
    renderNavigation: false,
    buttonPosition: 'inside',
    darkenNonIntersectingItems: false,
  },
} as Meta<ScrollableStorybookComponent>;

type Story = StoryObj<ScrollableStorybookComponent>;

export const Default: Story = {};

export const Vertical: Story = {
  args: { direction: 'vertical' },
};

export const WithNavigation: Story = {
  args: { renderNavigation: true },
};

export const WithSnap: Story = {
  args: { snap: true, scrollMode: 'element' },
};

export const FooterButtons: Story = {
  args: { buttonPosition: 'footer', renderNavigation: true },
};

export const StickyButtons: Story = {
  args: { stickyButtons: true },
};

export const DarkenNonIntersecting: Story = {
  args: { darkenNonIntersectingItems: true },
};

export const BorderMask: Story = {
  args: { maskVariant: 'border' },
};
