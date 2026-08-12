import { Meta, StoryObj, moduleMetadata } from '@storybook/angular';
import {
  CarouselHeadlessStorybookComponent,
  CarouselStorybookComponent,
  CarouselVariableWidthsStorybookComponent,
  CarouselWipeStorybookComponent,
} from './carousel-storybook.component';

export default {
  title: 'Components/Media/Carousel',
  component: CarouselStorybookComponent,
  decorators: [
    moduleMetadata({
      imports: [
        CarouselStorybookComponent,
        CarouselHeadlessStorybookComponent,
        CarouselVariableWidthsStorybookComponent,
        CarouselWipeStorybookComponent,
      ],
    }),
  ],
  args: {
    itemSize: 'full',
    loop: true,
    autoplay: false,
    autoplayTime: 5000,
    showControls: true,
    showDots: true,
    transition: 'none',
    transitionDriver: 'auto',
    slideAlign: 'start',
    surface: 'dark',
  },
  argTypes: {
    itemSize: { control: 'radio', options: ['full', 'half', 'third', 'auto'] },
    loop: { control: 'boolean' },
    autoplay: { control: 'boolean' },
    autoplayTime: { control: { type: 'range', min: 1000, max: 10000, step: 500 } },
    showControls: { control: 'boolean' },
    showDots: { control: 'boolean' },
    transition: { control: 'radio', options: ['none', 'dim', 'wipe', 'custom'] },
    transitionDriver: { control: 'radio', options: ['auto', 'scroll-timeline', 'js', 'none'] },
    slideAlign: { control: 'radio', options: ['start', 'center'] },
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
          'form too - one slide on a phone, three on a desktop - and the loop follows it, cloning enough slides ' +
          'to cover whatever a viewport currently holds.',
      },
    },
  },
};

export const Loop: Story = {
  args: { itemSize: 'half' },
  parameters: {
    docs: {
      description: {
        story:
          'Keep scrolling past either end. The track carries clones of the slides on both sides of the real ' +
          'run - live views of the same template, so anything bound or interactive inside a slide still works ' +
          'in its clone - and the scroll offset is shifted a whole track along once the scrolling has stopped ' +
          '(`scrollend`, never mid-animation, never while a finger is down). The dots keep counting the real ' +
          'slides, and the clones are `aria-hidden` and `inert`, so a reader never meets the same slide twice.',
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
          'screen - and it never starts at all under `prefers-reduced-motion`. The pause button is required ' +
          'rather than optional (WCAG 2.2.2): dev mode throws if autoplay runs without one. With `loop` on it ' +
          'no longer has an end to stop at.',
      },
    },
  },
};

export const DimTransition: Story = {
  args: { itemSize: 'half', transition: 'dim', slideAlign: 'center' },
  parameters: {
    docs: {
      description: {
        story:
          'Every transition follows the slide\'s position rather than an "active" flag, so it tracks a drag and ' +
          'reverses when you drag back instead of stepping when a flag flips. `dim` fades and shrinks the slides ' +
          "either side of the current one, as keyframes over `opacity` and `scale` along each slide's own " +
          '`view()` timeline - properties a browser can hand to the compositor, which routing them through an ' +
          'inherited custom property could not be.',
      },
    },
  },
};

export const WipeTransition: Story = {
  render: (args) => ({
    props: args,
    template: '<et-sb-carousel-wipe [surface]="surface" [transitionDriver]="transitionDriver" />',
  }),
  args: { itemSize: 'full', transition: 'wipe' },
  parameters: {
    docs: {
      description: {
        story:
          'The same one number, a different effect - and the Apple-TV-ish reveal the `@ethlete/cdk` carousel ' +
          'had, except driven by where the slide *is* rather than by a class flip, so it tracks a finger and ' +
          "reverses when you drag back. Each slide's content is pinned to the track while its own box keeps " +
          'scrolling, and the box clips it: two stationary pictures either side of one moving edge. Drag ' +
          'slowly to see it. It needs one slide per view - a peeking layout wants `dim` instead.',
      },
    },
  },
};

export const JsTransitionDriver: Story = {
  args: { itemSize: 'half', transition: 'dim', transitionDriver: 'js', slideAlign: 'center' },
  parameters: {
    docs: {
      description: {
        story:
          'The same effect, driven the other way. `transitionDriver="auto"` (the default) animates composited ' +
          "properties along each slide's own `view(inline)` timeline where the browser has scroll-driven " +
          'animations, and falls back to `calc()` over `--et-carousel-slide-progress`, written from a passive ' +
          'scroll listener batched into a frame, where it does not (Firefox, as of this writing). Forcing ' +
          '`"js"` here shows that fallback on a browser that would have used the timeline - it should be ' +
          'indistinguishable to look at, even though only the timeline can be composited.',
      },
    },
  },
};

export const VariableWidths: Story = {
  render: (args) => ({
    props: args,
    template: '<et-sb-carousel-variable-widths [surface]="surface" [transition]="transition" />',
  }),
  args: { transition: 'dim' },
  parameters: {
    docs: {
      description: {
        story:
          '`itemSize="auto"` lets every slide size itself, which is why the loop *measures* the distance to ' +
          'teleport rather than computing it from a slide width. The measurement is still exact: the track ' +
          'repeats with a period of one full set of slides, so the gap from a slide to its clone is the same ' +
          'wherever it is taken.',
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
          'with controls and readout written by hand and no chrome from the default component. A hand-built ' +
          'carousel renders its own children, so there are no clones and `loop` stays a jump back to the other ' +
          'end - seamless looping needs the carousel to render the slides.',
      },
    },
  },
};
