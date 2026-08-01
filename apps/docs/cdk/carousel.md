# Carousel

A slide carousel with configurable transitions, optional looping and autoplay, plus attachable nav directives. All logic lives in a headless `CarouselDirective` - `et-carousel` is just the styled shell.

```html
<et-carousel [autoPlay]="true">
  <et-carousel-item>
    <img src="slide-1.jpg" alt="First slide" />
  </et-carousel-item>
  <et-carousel-item [autoPlayTime]="10000">
    <img src="slide-2.jpg" alt="Second slide" />
  </et-carousel-item>

  <button etCarouselPreviousButton aria-label="Previous">‹</button>
  <button etCarouselNextButton aria-label="Next">›</button>
  <button etCarouselToggleAutoPlayButton aria-label="Toggle autoplay">⏯</button>
  <et-carousel-item-nav />
</et-carousel>
```

```ts
import { CarouselImports } from '@ethlete/cdk';
```

<StoryEmbed id="cdk-carousel--default" height="420px" />

Items (`et-carousel-item` or `[etCarouselItem]`) are projected into the slide area; everything else (buttons, nav) goes into the default slot.

## Options

| Input                   | Default        | Purpose                                                                                        |
| ----------------------- | -------------- | ---------------------------------------------------------------------------------------------- |
| `loop`                  | `true`         | Wrap around at the ends.                                                                       |
| `autoPlay`              | `false`        | Advance automatically.                                                                         |
| `autoPlayTime`          | `5000`         | Per-slide dwell time in ms; each item can override it with its own `autoPlayTime`.             |
| `pauseAutoPlayOnHover`  | `true`         | Pause while the pointer is over the slides.                                                    |
| `pauseAutoPlayOnFocus`  | `true`         | Pause while focus is inside the slides.                                                        |
| `pauseAutoPlayOnHidden` | `true`         | Pause while the carousel is scrolled out of view.                                              |
| `transitionType`        | `'mask-slide'` | Transition style (currently the only one).                                                     |
| `transitionDuration`    | `450`          | Transition length in ms; navigation is locked for this window to prevent mid-transition jumps. |

## Controls

The button directives attach to any element inside the carousel: `etCarouselPreviousButton` / `etCarouselNextButton` disable themselves at the ends when `loop` is off, and `etCarouselToggleAutoPlayButton` toggles play/pause (reflected as `--playing` / `--paused` classes). `et-carousel-item-nav` renders one dot per item; with autoplay on, the active dot animates the current slide's progress.

For a fully custom shell, apply `CarouselDirective` yourself - it exposes the whole state as signals (`activeIndex`, `isAtStart`, `isAtEnd`, `activeItemAutoPlayProgress`, …) and the `next()` / `prev()` / `goTo(index)` / `stopAutoPlay()` / `resumeAutoPlay()` API; the sub-directives find it via DI.

## Behavior & accessibility

Slides are stacked in a single grid cell; the mask-slide transition clips, translates and dims the outgoing slide. Inactive items are `inert` and `aria-hidden`, so hidden slide content is unreachable for keyboard and screen-reader users.

## Styling

Style against `et-carousel`, `et-carousel-items`, `et-carousel-item` (`active` / `previous-active`) and the nav classes (`et-carousel-item-nav-button` with `--progressing` / `--active-static`). Custom properties cover the slide easing and translate distance (`--et-carousel-slide-easing`, `--et-carousel-slide-translate`) and the dot sizes/colors (`--et-carousel-dot-*`).
