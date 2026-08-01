# Carousel

A track of slides you move through one at a time - or several at a time - with a seamless loop and
scroll-driven slide transitions. It is the [scrollable](/components/scrollable) configured as a
carousel, so the sliding **is** native scrolling: swipe, momentum, trackpad and keyboard scrolling all
come from the platform instead of from a transform the component animates.

```ts
import { CAROUSEL_IMPORTS } from '@ethlete/components';
```

```html
<et-carousel loop>
  <ng-template [etCarouselSlide]="teams()" let-team let-index="index">
    <h3>{{ index + 1 }}. {{ team.name }}</h3>
  </ng-template>
</et-carousel>
```

## Live demo

<StoryEmbed id="components-carousel--default" height="460px" />

## Slides are data and a template

There is one way to author slides: bind the array to an `etCarouselSlide` template, and the carousel
stamps it once per slide. You do **not** project slide elements.

That is not a style preference - it is what seamless looping requires. To cross the seam without
showing it the carousel needs the same slide rendered on **both sides** of it, and a clone has to be a
live Angular view: a copied DOM subtree has no bindings, so anything interactive or async inside a
cloned slide would be dead. (That is the documented cost of Swiper's loop mode; it isn't acceptable
here.) Rendering from a template also means the carousel owns the slide wrapper, so slide roles,
`N of M` labels and the clone marking are guaranteed rather than something you have to remember.

Binding the array to the template - rather than to `<et-carousel>` - is also what **types** it:

```html
<et-carousel [itemSize]="{ default: 'full', md: 'half' }" loop>
  <ng-template [etCarouselSlide]="teams()" let-team let-index="index" let-count="count">
    <!-- team is Team, inferred: no cast, no wrapper component -->
    <img [src]="team.crest" [alt]="team.name" />
    <p>{{ index + 1 }} of {{ count }} - {{ team.name }}</p>
  </ng-template>
</et-carousel>
```

The template context:

| Binding     | What it is                                                                           |
| ----------- | ------------------------------------------------------------------------------------ |
| `let-slide` | The slide itself (`$implicit`), typed from the bound array.                          |
| `let-index` | Its index in the array. A loop clone reports the index of the slide it clones.       |
| `let-count` | How many slides there are. Clones are not among them.                                |
| `let-first` | Whether it is the first slide.                                                       |
| `let-last`  | Whether it is the last slide.                                                        |
| `let-clone` | Whether this rendering is a loop clone - for the rare thing that must not run twice. |

## Anatomy

| Piece                                                            | What it is                                                                                         |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `et-carousel`                                                    | The carousel region: the scrolling track, previous/next controls, slide dots, optional autoplay.   |
| `etCarouselSlide`                                                | The `<ng-template>` the carousel stamps per slide. Carries the slides array and types the context. |
| `etCarousel`                                                     | Headless: turns a scrollable into a carousel (active slide, movement, region semantics).           |
| `etCarouselItem`                                                 | One slide's wrapper. `<et-carousel>` renders it for you; use it directly on a bare scrollable.     |
| `etCarouselAutoplay`                                             | Headless, opt-in: advances the carousel on its own, with all the pauses that need to happen.       |
| `etCarouselPrevious` / `etCarouselNext` / `etCarouselPlayToggle` | The controls, as directives for your own buttons.                                                  |

### Inputs

On `<et-carousel>`:

| Input              | Default   | Description                                                                                   |
| ------------------ | --------- | --------------------------------------------------------------------------------------------- |
| `itemSize`         | `'full'`  | How much of the track one slide takes - `'full'`, `'half'`, `'third'`, `'quarter'`, `'auto'`. |
| `loop`             | `true`    | Cross the seam without showing it - see [Looping](#looping).                                  |
| `slideAlign`       | `'start'` | Where the current slide rests: `'start'` or `'center'` - see [Alignment](#alignment).         |
| `autoplay`         | `false`   | Advance on its own. Renders the required pause control.                                       |
| `autoplayTime`     | `5000`    | Milliseconds per slide.                                                                       |
| `transition`       | `'none'`  | `'dim'`, `'wipe'` or `'custom'` - see [Transitions](#transitions).                            |
| `transitionDriver` | `'auto'`  | What drives the transition - see [Two drivers](#two-drivers).                                 |
| `showControls`     | `true`    | Render the previous/next controls.                                                            |
| `showDots`         | `true`    | Render the slide dots (which double as the autoplay progress indicator).                      |
| `labels`           | `null`    | Per-instance string overrides; prefer `provideCarouselLabels` app-wide.                       |

On the `etCarouselSlide` template:

| Input             | Default | Description                                                                                     |
| ----------------- | ------- | ----------------------------------------------------------------------------------------------- |
| `etCarouselSlide` | -       | Required. The slides to render, one stamp each. Also what types the template context.           |
| `autoplayTimeFor` | `null`  | `(slide, index) => number \| null` - a per-slide autoplay duration. `null` uses `autoplayTime`. |

`itemSize` takes the scrollable's per-breakpoint form, so one carousel can show one slide on a phone
and three on a desktop - and the loop follows it, cloning enough slides to cover whatever a viewport
currently holds:

```html
<et-carousel [itemSize]="{ default: 'full', md: 'half', lg: 'third' }">…</et-carousel>
```

The [Multiple items](https://ethlete-sdk.web.app/?path=/story/components-carousel--multiple-items) story
shows it live (four embeds per page is the practical limit here, so this one stays a link).

### Alignment

`slideAlign` decides where the current slide comes to rest. `'start'` lines it up with the start of the
track. `'center'` puts it in the middle, which is what turns a multi-item layout into _one_ current slide
with its neighbours peeking either side rather than a row that happens to be cut off:

```html
<et-carousel itemSize="half" slideAlign="center" transition="dim" loop>…</et-carousel>
```

It makes no difference at `itemSize="full"`, where a slide fills the track either way. Centring the first
or last slide needs content beyond it, so it comes into its own on a looping carousel - which is also
where the transitions read best, since every effect is measured from the centre.

## Looping

`loop` is a **seamless** loop, not a rewind. The track carries clones of the slides on both sides of
the real run, and the carousel shifts its scroll offset a whole track's length whenever it drifts into
them - so you can keep scrolling past either end and never arrive at a wall.

The shift happens on **`scrollend`**, never mid-animation (that is when a jump would be visible), and
never while a finger is down - a teleport during a drag would fight the gesture, so it waits for the
pointer to come up. Where `scrollend` is missing, a quiet stretch of `scroll` events stands in for it.
The distance is **measured**, not computed from `itemSize`, because `itemSize="auto"` lets every slide
be a different width; it is exact regardless, since the track repeats with a period of one full set of
slides.

The shift is written with the track's [snapping suspended](/components/scrollable#snapping-and-programmatic-scrolling),
because `scroll-snap-type: mandatory` would otherwise be free to overrule the offset. The offset happens to be
a snap position - a slide and its clone sit the same distance from theirs - but a seamless loop is not
something to stake on "happens to".

What this means in practice:

- `next()` past the last slide and `previous()` before the first simply keep scrolling, and both
  controls stay operable rather than going `aria-disabled`.
- `goTo(index)` and the dots go the **shorter way round**: with six slides, slide 5 is one step back from
  slide 1, not five forward.
- The dots keep counting the **real** slides, and the active dot follows the slide on screen however
  far the track has looped. `activeIndex()` is likewise always a slide index.
- Clones are `aria-hidden` and `inert`, and carry no `N of M` label, so a screen reader user never
  meets the same slide twice. They are marked `data-clone` if you need to see them in the DOM.

<StoryEmbed id="components-carousel--loop" height="440px" />

Seamless looping needs rendered clones, so it applies where the carousel renders the slides. In two
cases `loop` stays a wrapping _jump_ back to the other end instead:

- **Every slide already fits a viewport.** There is no seam to cross, and nothing to clone from.
- **A hand-built carousel** over a bare `<et-scrollable>` - it owns its own DOM, so the carousel has no
  template to stamp clones from. See [Headless](#headless).

`isLooping()` says which of the two a carousel is doing, and the host reports `data-looping` when the
loop is seamless. `itemSize="auto"` is covered by the
[Variable widths](https://ethlete-sdk.web.app/?path=/story/components-carousel--variable-widths) story.

### Navigation is always one step

However far away the target is, the carousel animates **one slide** and covers the rest instantly. A browser
gives a smooth scroll the same duration whatever the distance, so a multi-slide jump is a blur either way -
and with a position-driven transition it is a blur of one transition per slide crossed. One step, at the
speed a step is meant to take.

Rapid clicks step from where the carousel is _going_, not from where it is. The active slide is read from an
IntersectionObserver, which reports a frame or two late, so stepping from that made a second click during the
first one's animation go nowhere - or retarget the scroll backwards mid-flight. `activeIndex()` reports the
pending target while a press is being animated, which is also why the dots move with the click rather than
after it.

## Transitions

Every transition follows the slide's **position** rather than an "active" flag, which is what makes it track
a drag and reverse when you drag back instead of stepping when a flag flips.

| `transition` | What it does                                                                             |
| ------------ | ---------------------------------------------------------------------------------------- |
| `'none'`     | The plain scroll. The default, and injects none of the transition CSS.                   |
| `'dim'`      | Fades and shrinks the slides either side of the current one.                             |
| `'wipe'`     | Two stationary slides either side of one sweeping edge. Needs one slide per view.        |
| `'custom'`   | No effect of its own - fills `--et-carousel-slide-progress` for CSS of yours. See below. |

```html
<et-carousel itemSize="half" transition="dim">…</et-carousel>
```

`wipe` is the `@ethlete/cdk` carousel's `mask-slide` rebuilt against position instead of a class flip, and
it is all three parts of it: the wipe itself, the 125px push of the two slides against each other, and the
dip in brightness on whichever is leaving. What makes it a _wipe_ rather than a sliding crop is that each
slide's content is pinned to the track while the slide's own box keeps scrolling and clips it - so the
reader sees two still pictures and one moving boundary. Drag slowly and it tracks the finger; drag back and
it reverses.

The brightness dip is drawn as a veil over the slide (a black overlay whose opacity follows the position)
rather than as a `filter` on it. A filter has to re-rasterize everything underneath it whenever its value
changes, which on a slide-sized layer is a full repaint per frame - measured at ~1800 paints over eight
swipes, three and a half times what the same carousel costs without it, and the reason the wipe showed torn
half-drawn tiles on a phone. Override `--et-carousel-wipe-dim-color` if a slide should recede towards
something other than black.

It applies only where the track shows one slide per view. With the content pinned to the track, a slide
whose box is partly on screen at rest would have its content outside that box and show as blank - so a
peeking layout wants `dim`.

<StoryEmbed id="components-carousel--wipe-transition" height="440px" />

### Two drivers

`transitionDriver` decides what drives the movement, so an effect looks the same in every browser:

| Value               | What drives it                                                                                            |
| ------------------- | --------------------------------------------------------------------------------------------------------- |
| `'auto'`            | The default: `'scroll-timeline'` where the browser has scroll-driven animations, `'js'` where it doesn't. |
| `'scroll-timeline'` | Keyframes on each slide's own `view(inline)` timeline. No JavaScript at all.                              |
| `'js'`              | A passive `scroll` listener batched into a frame. The fallback for Firefox, as of this writing.           |
| `'none'`            | Nothing runs - for a page that would rather have the plain scroll.                                        |

Under `'scroll-timeline'` the built-in effects are keyframes over `opacity`, `scale` and `translate`, which a
browser can hand to the compositor. Under `'js'` they are `calc()` over `--et-carousel-slide-progress`, which
the driver writes each frame - the same numbers over the same range, so the two are indistinguishable to look
at, but only the first can be composited. The
[JS transition driver](https://ethlete-sdk.web.app/?path=/story/components-carousel--js-transition-driver)
story runs them side by side.

The JS driver measures the slides once per layout change, so a frame costs one scroll-offset read for
the whole track, and slides whose progress has settled (anything off screen sits at ±1) stop being
written at all.

`prefers-reduced-motion` resolves the driver to `'none'` whatever you ask for. Nothing then drives the
slides, so the effects don't apply at all and the slides are left entirely alone - rather than pinned
at whatever their centred values happen to be.

### Writing your own effect

`transition="custom"` fills `--et-carousel-slide-progress`, a registered custom property on each slide that
runs from `-1` just before the slide enters the track's viewport, through `0` at centred, to `1` once it has
left. It inherits, so slide _content_ can read it too, and the host reports `data-transition` and
`data-transition-driver`. That is enough to hang your own effect on it, with no driver of your own:

```html
<et-carousel transition="custom" itemSize="full">…</et-carousel>
```

```css
/* only while a driver is actually running, so reduced motion turns this off too */
[data-transition-driver='scroll-timeline'] [data-transition='custom'] .et-carousel-item img,
[data-transition-driver='js'] [data-transition='custom'] .et-carousel-item img {
  translate: calc(var(--et-carousel-slide-progress) * -20%);
}
```

It is its own `transition` value rather than something `dim` and `wipe` also do, because that property is the
expensive part of the whole system. It inherits, so changing it on a slide invalidates the style of
everything inside that slide, and a scroll changes it every frame. Measured over eight swipes on a
six-times-throttled CPU: animating the property cost **263ms** of style recalculation and the `calc()` rules
that read it cost **3ms** - the number was never the cheap part. The built-ins therefore don't go through it,
and asking for it is what makes it worth paying for.

## Autoplay

`autoplay` advances the carousel and draws the countdown as a ring closing around the active dot. It is
opt-in on `<et-carousel>` and off by default. It
pauses whenever moving the page under the reader would be rude, and reports which of those is
happening via `pauseReason()`:

| Reason           | When                                                             |
| ---------------- | ---------------------------------------------------------------- |
| `hover`          | the pointer is over the carousel                                 |
| `focus`          | focus is inside it                                               |
| `off-screen`     | the carousel is scrolled out of view                             |
| `page-hidden`    | this tab isn't the one in front                                  |
| `reduced-motion` | the reader asked for reduced motion - autoplay then never starts |
| `stopped`        | the pause control (or `stop()`) was used                         |
| `no-slides`      | there are fewer than two slides, so there is nowhere to advance  |
| `disabled`       | `autoplay` is off                                                |

`page-hidden` and `off-screen` are separate checks because they are separate questions: an
IntersectionObserver reports a fully visible element in a background tab. The first matters more - a hidden
tab throttles timers rather than stopping them, so without it a carousel spends its time in the background
queueing up slide changes to deliver all at once when you come back. Both are covered by `pauseOnOffScreen`.

Resuming gives the current slide its **full** duration again rather than continuing a partial one, so
the ring and the timer are the same clock and can't drift apart. A looping carousel has no end to stop
at; without `loop`, autoplay stops at the last slide instead of jumping back to the start forever.

A slide that needs longer to read gets its own duration from `autoplayTimeFor` on the template, where
the slide type is:

```html
<et-carousel [autoplayTime]="5000" autoplay>
  <ng-template [etCarouselSlide]="slides()" [autoplayTimeFor]="restLongerOnText" let-slide>…</ng-template>
</et-carousel>
```

```ts
protected restLongerOnText = (slide: Slide) => (slide.body ? 9000 : null);
```

A carousel that moves on its own must offer a way to stop it (WCAG 2.2.2) - `<et-carousel>` renders the
pause control for you, and the headless `etCarouselAutoplay` throws in dev mode if no
`etCarouselPlayToggle` is registered. Hovering or focusing **that control** is not counted as the hover or
focus pause: it lives inside the carousel, so pressing play would otherwise be cancelled by the pointer
still resting on the button that was just pressed, and autoplay could never be restarted. Hovering a
_slide_ pauses as it should. The
[Autoplay](https://ethlete-sdk.web.app/?path=/story/components-carousel--autoplay) story shows it live.

On the headless `etCarouselAutoplay`, `enabled` defaults to `true` - putting the directive on an element
_is_ the opt-in there - so read `isEnabled()` for what is actually in effect. `<et-carousel>` always carries
the directive and so cannot let that default stand; its own `autoplay` input takes the value over.

The countdown ring closes by rotating two half-discs, one per half of the circle, rather than by animating
the angle of a `conic-gradient`. `rotate` is composited; a gradient is not - it has to be re-rasterized for
every value, and animating a registered property recalculates style every frame whether the value moved or
not. Idle, the gradient version cost ~1120 paints and ~510 style recalculations over nine seconds; the
rotations cost ~139 and ~89, which is within measurement noise of rendering no ring at all.

## Headless

`etCarousel` needs a scrollable to move and finds one three ways: on its own element
(`<et-scrollable etCarousel>`), in its content (`<div etCarousel>` wrapped around a scrollable), or
handed over by `<et-carousel>`. **Wrapping is usually what you want** - slides and controls resolve the
carousel from an ancestor, so they have to be inside it:

A hand-built carousel imports the scrollable itself, so it also needs `SCROLLABLE_DRAG_IMPORTS` for
`etScrollableSnap` (`<et-carousel>` brings its own).

```html
<div #carousel="etCarousel" etCarousel>
  <et-scrollable etScrollableSnap itemSize="half" scrollMode="element">
    <div etCarouselItem>…</div>
    <div etCarouselItem>…</div>
  </et-scrollable>

  <button etCarouselPrevious>Back</button>
  <span>Slide {{ carousel.activeIndex() + 1 }} of {{ carousel.count() }}</span>
  <button etCarouselNext>Forward</button>
</div>
```

The directive exposes `activeIndex()`, `count()`, `isLooping()`, `isAtStart()`, `isAtEnd()`,
`canGoPrevious()`, `canGoNext()`, `next()`, `previous()` and `goTo(index)` - every index a slide index,
clones mapped away. The active slide is derived from how much of each slide the scroll container can
see, which is what makes it follow a drag as readily as a click.

A hand-built carousel renders its own children, so it gets no clones and `loop` stays the wrapping
jump. It does still get the transition system: `transition` mounts the progress property and the
effects, and `.et-carousel-item` is the element they apply to.

<StoryEmbed id="components-carousel--headless" height="360px" />

## Accessibility

- The carousel is a `role="region"` with `aria-roledescription="carousel"` and a label, wrapping both the
  track and the controls.
- Each slide is a `role="group"` with `aria-roledescription="slide"` and an `N of M` label counting the
  real slides.
- **Loop clones are `aria-hidden` and `inert` and carry no label.** They are the same slide a second
  time, so a reader is never told about it twice and never tabs into a duplicate.
- Real slides are **not** hidden or `inert` while off screen. This carousel scrolls, so an off-screen
  slide is reachable by scrolling and by tabbing into it (which scrolls it into view) - hiding them
  would take that away. A carousel that stacks its slides, like the one in `@ethlete/cdk`, does need to
  hide them.
- The controls are real labelled buttons (the scrollable's own buttons and dots are decorative, and are not imported here at all). At the ends of a non-looping carousel they report `aria-disabled` rather than going
  natively disabled, so they keep their place in the tab order; while looping they stay operable,
  because there is always somewhere to go.
- The dots are buttons labelled "Go to slide N", with `aria-current` on the current one.
- Autoplay: pauses on hover and focus, never starts under `prefers-reduced-motion`, and requires a pause
  control.
- Slide transitions stop entirely under `prefers-reduced-motion` - the driver never runs.

Localize every string app-wide with `provideCarouselLabels`:

```ts
provideCarouselLabels({ previous: 'Vorheriges Bild', next: 'Nächstes Bild', slide: (i, n) => `${i} von ${n}` });
```

## Theming

Colours come from the app-registered [surface and color themes](/core/theming): the dots and the
progress ring take the primary accent, inactive dots a neutral tint. Geometry is tokens:

| Property                        | Default | Applies to                                                                                           |
| ------------------------------- | ------- | ---------------------------------------------------------------------------------------------------- |
| `--et-carousel-gap`             | `12px`  | gap between the track and the controls row                                                           |
| `--et-carousel-dot-size`        | `8px`   | the dot itself                                                                                       |
| `--et-carousel-dot-target-size` | `24px`  | the dot's tap target                                                                                 |
| `--et-carousel-dot-ring-size`   | `18px`  | the autoplay countdown ring                                                                          |
| `--et-carousel-dot-ring-width`  | `2.5px` | how thick that ring is drawn                                                                         |
| `--et-carousel-edge-fade`       | `32px`  | how far the track's edges fade where a centred peeking layout cuts a slide off; `0px` for a hard cut |

`wipe` has knobs of its own, matching what cdk's `mask-slide` used:

| Property                       | Default | Applies to                                                                |
| ------------------------------ | ------- | ------------------------------------------------------------------------- |
| `--et-carousel-wipe-shift`     | `125px` | how far the two slides are pushed against each other; `0` for a pure wipe |
| `--et-carousel-wipe-dim`       | `0.5`   | how dark a slide goes as it leaves                                        |
| `--et-carousel-wipe-dim-color` | `#000`  | what it darkens _with_ - the veil's colour                                |

`--et-carousel-slide-progress` (`<number>`, inherits) is an input to read rather than a knob to set, and only
`transition="custom"` fills it - see [writing your own effect](#writing-your-own-effect). The transition CSS
is only injected once a carousel asks for a `transition`, so the default carousel carries none of it.

Slide sizing, spacing and the scroll behaviour itself are the [scrollable's](/components/scrollable)
to configure.

## Error codes

The carousel throws `ET38xx` in dev mode - see
[error codes](/components/error-codes#carousel-et38xx).
