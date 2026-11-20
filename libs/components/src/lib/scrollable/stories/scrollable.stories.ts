import { applicationConfig, Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { provideScrollableConfig } from '../headless/scrollable-config';
import { SCROLLABLE_IMPORTS, SCROLLABLE_NAVIGATION_IMPORTS } from '../scrollable.imports';
import { ScrollableStorybookComponent } from './components';

export default {
  title: 'Components/Layout/Scrollable',
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
    buttonSize: {
      control: { type: 'select' },
      options: ['xs', 'sm', 'md', 'lg', 'xl'],
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
    card: {
      control: { type: 'select' },
      options: ['none', 'class', 'image'],
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
    buttonSize: 'xs',
    darkenNonIntersectingItems: false,
    card: 'none',
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

export const InlineButtons: Story = {
  args: { buttonPosition: 'inline' },
};

export const InlineButtonsVertical: Story = {
  args: { buttonPosition: 'inline', direction: 'vertical' },
};

export const ProvidedButtons: Story = {
  decorators: [
    applicationConfig({
      providers: [
        provideScrollableConfig({
          buttons: { enabled: { md: true }, position: { xs: 'inline', lg: 'inside' } },
        }),
      ],
    }),
    moduleMetadata({ imports: [SCROLLABLE_IMPORTS, SCROLLABLE_NAVIGATION_IMPORTS] }),
  ],
  render: () => ({
    template: `
      <div data-testid="provided" class="w-full max-w-xl">
        <et-scrollable class="block">
          <div class="flex gap-2">
            @for (i of [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16]; track i) {
              <div class="shrink-0 w-32 h-16 bg-gray-200 flex items-center justify-center">{{ i }}</div>
            }
          </div>
        </et-scrollable>
      </div>
    `,
  }),
};

export const StickyChild: Story = {
  decorators: [moduleMetadata({ imports: [SCROLLABLE_IMPORTS] })],
  render: () => ({
    template: `
      <div class="w-full max-w-xl">
        <et-scrollable data-testid="sticky" class="block" style="--et-scrollable-mask-inset-start: 6rem">
          <div class="flex gap-2">
            <div data-testid="sticky-child" style="background:#00f" class="sticky left-0 z-10 shrink-0 w-24 h-16 flex items-center justify-center">Sticky</div>
            @for (i of [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16]; track i) {
              <div class="shrink-0 w-32 h-16 bg-gray-200 flex items-center justify-center">{{ i }}</div>
            }
          </div>
        </et-scrollable>
      </div>
    `,
  }),
};

export const StickyButtons: Story = {
  args: { stickyButtons: true },
};

export const LargeButtons: Story = {
  args: { buttonSize: 'lg' },
};

export const DarkenNonIntersecting: Story = {
  args: { darkenNonIntersectingItems: true },
};

export const BorderMask: Story = {
  args: { maskVariant: 'border' },
};

export const OnClassBackgroundCard: Story = {
  args: { card: 'class' },
};

export const OnImageBackgroundCard: Story = {
  args: { card: 'image', renderScrollbars: true },
};
