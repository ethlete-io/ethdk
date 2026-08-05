# Timeline

`et-timeline` is a vertical rail of chronological events - an activity feed, an audit log, a match report. Project one `et-timeline-item` per event in reading order; the connecting line and the markers are drawn for you. Reach for [progress steps](/components/progress-steps) instead when the items are the stages of one linear process rather than things that already happened, and for [description list](/components/description-list) when the rows are labelled facts with no time dimension. Import `TIMELINE_IMPORTS`.

```ts
import { TIMELINE_IMPORTS } from '@ethlete/components';
```

```html
<et-timeline>
  <et-timeline-item>
    <span etTimelineTime>18:30</span>
    <p>Squad announced</p>
  </et-timeline-item>

  <et-timeline-item color="success">
    <span etTimelineTime>23'</span>
    <p>Goal by A. Rossi</p>
  </et-timeline-item>
</et-timeline>
```

## Live demo

<StoryEmbed id="components-timeline--default" height="280px" />

## Anatomy

An item is two columns: the **rail** and the **content**.

The rail holds the marker and draws the line. Each item draws its own segment, from its marker's center down through the gap to the next item's marker, and the markers paint over it - so the rail reads as one unbroken line no matter how tall the individual items are. The last item draws no segment, which is what makes the line stop rather than trail off.

The content column takes the default slot plus the `[etTimelineTime]` slot, which is lifted above whatever else you project. Everything in it is yours - a heading, a paragraph, a [card](/components/card), a nested [description list](/components/description-list).

## Options

`et-timeline` takes no inputs; it is a layout container configured through its [design tokens](#theming).

| Input on `et-timeline-item` | Type                          | Default | Description                                                        |
| --------------------------- | ----------------------------- | ------- | ------------------------------------------------------------------ |
| `color`                     | registered color theme / name | -       | Scopes a color theme to this item, which is what tints its marker. |

## Markers

With nothing projected into the marker slot, an item renders the default dot, sized by `--et-timeline-dot-size` and colored by the item's color scope. Project `[etTimelineMarker]` to replace it with an icon, an avatar, a number - anything that fits a `--et-timeline-marker-size` box:

```html
<et-timeline-item color="error">
  <span etTimelineTime>14:02</span>
  <i etTimelineMarker etIcon="et-triangle-exclamation"></i>
  <p>Deployment failed</p>
</et-timeline-item>
```

A projected marker sits on the surface background rather than on the line, so an icon stays legible where the rail passes behind it. Mixing dot items and icon items in one timeline is fine - both are centered on the same rail.

<StoryEmbed id="components-timeline--with-markers" height="280px" />

## Density

Every token inherits, so one declaration on the timeline re-sizes every item inside it:

```css
.my-activity-feed {
  --et-timeline-gap: 8px;
  --et-timeline-rail-gap: 8px;
  --et-timeline-marker-size: 14px;
  --et-timeline-dot-size: 6px;
}
```

<StoryEmbed id="components-timeline--compact" height="240px" />

## Accessibility

The timeline is `role="list"` and each item is `role="listitem"`, so the count is announced and the items are navigable as a list. The rail is drawn entirely with a pseudo-element and carries nothing for assistive technology to read.

Nothing here is focusable or interactive. If an event links somewhere, project a real link or [button](/components/button) into the item's content - the timeline imposes no keyboard model of its own, so those controls keep the document's natural tab order.

The `[etTimelineTime]` slot is styling only: it carries no `<time>` semantics. Project an actual `<time datetime="…">` into it when the value is a machine-readable timestamp.

## Theming

Public design tokens, all inherited so they can be set once on `et-timeline`:

| Token                          | Default | Controls                                                 |
| ------------------------------ | ------- | -------------------------------------------------------- |
| `--et-timeline-gap`            | `16px`  | Vertical space between items - the line runs through it. |
| `--et-timeline-rail-gap`       | `12px`  | Space between the rail and the content column.           |
| `--et-timeline-marker-size`    | `20px`  | The marker box; also where the line meets it.            |
| `--et-timeline-dot-size`       | `8px`   | The default dot, when no marker is projected.            |
| `--et-timeline-line-thickness` | `2px`   | Width of the connecting line.                            |
| `--et-timeline-time-font-size` | `12px`  | Font size of the `[etTimelineTime]` slot.                |

Two colors are deliberately not registered tokens, because they default to the theme: `--et-timeline-marker-color` falls back to `--et-theme-color-primary-solid` (which is what an item's `color` scope changes), and `--et-timeline-line-color` falls back to `--et-surface-border-solid`. Override them with other theme tokens rather than literals. The time text and the marker's backdrop read from the surface theme directly. See [theming](/core/theming) for the token set.
