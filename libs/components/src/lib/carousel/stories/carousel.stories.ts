import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import { CarouselHeadlessStorybookComponent, CarouselStorybookComponent } from './carousel-storybook.component';

export default {
  title: 'Components/Carousel',
  component: CarouselStorybookComponent,
  decorators: [moduleMetadata({ imports: [CarouselStorybookComponent, CarouselHeadlessStorybookComponent] })],
  args: {
    itemSize: 'full',
    loop: true,
    autoplay: false,
    autoplayTime: 5000,
    showControls: true,
    showDots: true,
    transition: 'none',
    surface: 'dark',
  },
  argTypes: {
    itemSize: { control: 'radio', options: ['full', 'half', 'third', 'auto'] },
    loop: { control: 'boolean' },
    autoplay: { control: 'boolean' },
    autoplayTime: { control: { type: 'range', min: 1000, max: 10000, step: 500 } },
    showControls: { control: 'boolean' },
    showDots: { control: 'boolean' },
    transition: { control: 'radio', options: ['none', 'dim'] },
    surface: { control: 'text' },
  },
} as Meta<CarouselStorybookComponent>;

type Story = StoryObj<CarouselStorybookComponent>;

export const Default: Story = {};

export const MultipleItems: Story = {
  args: { itemSize: 'half' },
  parameters: {
    docs: {
      description: {
        story:
          '`itemSize` decides how much of the track a slide takes, so a carousel showing two or three at a time ' +
          "is a config change rather than a different component. It accepts the scrollable's per-breakpoint " +
          'form too — one slide on a phone, three on a desktop.',
      },
    },
  },
};

export const Autoplay: Story = {
  args: { autoplay: true, autoplayTime: 3000 },
  parameters: {
    docs: {
      description: {
        story:
          'Autoplay advances the carousel and draws its countdown as a ring around the active dot. It pauses ' +
          'while the pointer is over the carousel, while focus is inside it, and while it is scrolled off ' +
          'screen — and it never starts at all under `prefers-reduced-motion`. The pause button is required ' +
          'rather than optional (WCAG 2.2.2): dev mode throws if autoplay runs without one.',
      },
    },
  },
};

export const DimTransition: Story = {
  args: { itemSize: 'half', transition: 'dim' },
  parameters: {
    docs: {
      description: {
        story:
          'A scroll-driven transition: each slide animates along its own `view()` timeline, so the slides ' +
          'either side of the centre recede *as you drag*, not when a flag flips. No JavaScript is involved. ' +
          "Where the timeline isn't implemented yet (Firefox, as of this writing) the carousel is simply the " +
          'plain scroll — the effect is an enhancement, never a requirement.',
      },
    },
  },
};

export const Headless: Story = {
  render: (args) => ({ props: args, template: '<et-sb-carousel-headless [surface]="surface" />' }),
  parameters: {
    docs: {
      description: {
        story:
          '`etCarousel` on a plain `<et-scrollable>`: the active slide, the movement and the slide semantics, ' +
          'with controls and readout written by hand and no chrome from the default component.',
      },
    },
  },
};
