# Carousel

A track of slides you move through one at a time — or several at a time. It is the
[scrollable](/components/scrollable) configured as a carousel, so the sliding **is** native
scrolling: swipe, momentum, trackpad and keyboard scrolling all come from the platform instead of
from a transform the component animates.

```ts
import { CAROUSEL_IMPORTS } from '@ethlete/components';
```

```html
<et-carousel>
  <div etCarouselItem>…</div>
  <div etCarouselItem>…</div>
  <div etCarouselItem>…</div>
</et-carousel>
```

## Live demo

<StoryEmbed id="components-carousel--default" height="440px" />

## Anatomy

| Piece                                                            | What it is                                                                                       |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `et-carousel`                                                    | The carousel region: the scrolling track, previous/next controls, slide dots, optional autoplay. |
| `etCarouselItem`                                                 | One slide. Carries the slide semantics and can override the autoplay duration.                   |
| `etCarousel`                                                     | Headless: turns a scrollable into a carousel (active slide, movement, region semantics).         |
| `etCarouselAutoplay`                                             | Headless, opt-in: advances the carousel on its own, with all the pauses that need to happen.     |
| `etCarouselPrevious` / `etCarouselNext` / `etCarouselPlayToggle` | The controls, as directives for your own buttons.                                                |

### Inputs

| Input          | Default  | Description                                                                                   |
| -------------- | -------- | --------------------------------------------------------------------------------------------- |
| `itemSize`     | `'full'` | How much of the track one slide takes — `'full'`, `'half'`, `'third'`, `'quarter'`, `'auto'`. |
| `loop`         | `true`   | Wrap around at the ends. Off leaves the controls `aria-disabled` there.                       |
| `autoplay`     | `false`  | Advance on its own. Renders the required pause control.                                       |
| `autoplayTime` | `5000`   | Milliseconds per slide. A slide can override it with its own `autoplayTime`.                  |
| `transition`   | `'none'` | `'dim'` adds a scroll-driven focus effect — see [Transitions](#transitions).                  |
| `showControls` | `true`   | Render the previous/next controls.                                                            |
| `showDots`     | `true`   | Render the slide dots (which double as the autoplay progress indicator).                      |
| `labels`       | `null`   | Per-instance string overrides; prefer `provideCarouselLabels` app-wide.                       |

`itemSize` also takes the scrollable's per-breakpoint form, so one carousel can show one slide on a
phone and three on a desktop:

```html
<et-carousel [itemSize]="{ default: 'full', md: 'half', lg: 'third' }">…</et-carousel>
```

The [Multiple items](https://ethlete-sdk.web.app/?path=/story/components-carousel--multiple-items) story
shows it live (four embeds per page is the practical limit here, so this one stays a link).

## Autoplay

`autoplay` advances the carousel and draws the countdown as a ring closing around the active dot. It
pauses whenever moving the page under the reader would be rude, and reports which of those is
happening via `pauseReason()`:

| Reason           | When                                                             |
| ---------------- | ---------------------------------------------------------------- |
| `hover`          | the pointer is over the carousel                                 |
| `focus`          | focus is inside it                                               |
| `off-screen`     | the carousel is scrolled out of view                             |
| `reduced-motion` | the reader asked for reduced motion — autoplay then never starts |
| `stopped`        | the pause control (or `stop()`) was used                         |
| `disabled`       | `autoplay` is off                                                |

Resuming gives the current slide its **full** duration again rather than continuing a partial one, so
the ring and the timer are the same clock and can't drift apart. At the last slide of a carousel that
doesn't `loop`, autoplay stops instead of jumping back to the start forever.

A carousel that moves on its own must offer a way to stop it (WCAG 2.2.2) — `<et-carousel>` renders the
pause control for you, and the headless `etCarouselAutoplay` throws in dev mode if no
`etCarouselPlayToggle` is registered.

<StoryEmbed id="components-carousel--autoplay" height="440px" />

## Transitions

`transition="dim"` fades and shrinks the slides either side of the current one. It is a **scroll-driven**
animation — each slide runs its keyframes along its own `view()` timeline — so the effect tracks a finger
through a drag instead of stepping when some "active" flag flips, and it costs no JavaScript.

```html
<et-carousel itemSize="half" transition="dim">…</et-carousel>
```

The whole effect sits behind `@supports (animation-timeline: view(inline))` and a
`prefers-reduced-motion` check. Where scroll-driven animations aren't implemented yet — Firefox, as of
this writing — the carousel is simply the plain scroll: the effect is an enhancement, never a
requirement. That is also why it can ship now.

For a different look, the carousel exposes `data-transition` on its host, and slides carry
`.et-carousel-item` and `data-active` — enough to hang your own scroll-driven keyframes on:

```css
@supports (animation-timeline: view(inline)) {
  .my-carousel[data-transition='wipe'] .et-carousel-item {
    animation: my-wipe linear both;
    animation-timeline: view(inline);
  }
}
```

<StoryEmbed id="components-carousel--dim-transition" height="440px" />

## Headless

`etCarousel` needs a scrollable to move and finds one three ways: on its own element
(`<et-scrollable etCarousel>`), in its content (`<div etCarousel>` wrapped around a scrollable), or
handed over by `<et-carousel>`. **Wrapping is usually what you want** — slides and controls resolve the
carousel from an ancestor, so they have to be inside it:

```html
<div #carousel="etCarousel" etCarousel>
  <et-scrollable [snap]="true" itemSize="half" scrollMode="element">
    <div etCarouselItem>…</div>
    <div etCarouselItem>…</div>
  </et-scrollable>

  <button etCarouselPrevious>Back</button>
  <span>Slide {{ carousel.activeIndex() + 1 }} of {{ carousel.count() }}</span>
  <button etCarouselNext>Forward</button>
</div>
```

The directive exposes `activeIndex()`, `count()`, `isAtStart()`, `isAtEnd()`, `canGoPrevious()`,
`canGoNext()`, `next()`, `previous()` and `goTo(index)`. The active slide is derived from how much of
each slide the scroll container can see, which is what makes it follow a drag as readily as a click.

<StoryEmbed id="components-carousel--headless" height="360px" />

## Accessibility

- The carousel is a `role="region"` with `aria-roledescription="carousel"` and a label, wrapping both the
  track and the controls.
- Each slide is a `role="group"` with `aria-roledescription="slide"` and an `N of M` label.
- Slides are **not** hidden or `inert` while off screen. This carousel scrolls, so an off-screen slide is
  reachable by scrolling and by tabbing into it (which scrolls it into view) — hiding them would take that
  away. A carousel that stacks its slides, like the one in `@ethlete/cdk`, does need to hide them.
- The controls are real labelled buttons (the scrollable's own buttons and dots are decorative and stay
  turned off here). At the ends of a non-looping carousel they report `aria-disabled` rather than going
  natively disabled, so they keep their place in the tab order.
- The dots are buttons labelled "Go to slide N", with `aria-current` on the current one.
- Autoplay: pauses on hover and focus, never starts under `prefers-reduced-motion`, and requires a pause
  control.

Localize every string app-wide with `provideCarouselLabels`:

```ts
provideCarouselLabels({ previous: 'Vorheriges Bild', next: 'Nächstes Bild', slide: (i, n) => `${i} von ${n}` });
```

## Theming

Colours come from the app-registered [surface and color themes](/core/theming): the dots and the
progress ring take the primary accent, inactive dots a neutral tint. Geometry is tokens:

| Property                        | Default | Applies to                                 |
| ------------------------------- | ------- | ------------------------------------------ |
| `--et-carousel-gap`             | `12px`  | gap between the track and the controls row |
| `--et-carousel-dot-size`        | `8px`   | the dot itself                             |
| `--et-carousel-dot-target-size` | `24px`  | the dot's tap target and the progress ring |

Slide sizing, spacing and the scroll behaviour itself are the [scrollable's](/components/scrollable)
to configure.

## Error codes

The carousel throws `ET38xx` in dev mode — see
[error codes](/components/error-codes#carousel-et38xx).
