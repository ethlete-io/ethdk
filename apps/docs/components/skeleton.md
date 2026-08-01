# Skeleton

A loading placeholder: shapes standing in for content that hasn't arrived, with an
optional shimmer. Light by default - the container announces the wait, the shapes are
sized by their `shape` or by your own CSS, and every colour comes from the
[surface tokens](/core/theming), so a skeleton reads correctly on any surface it sits on.

```ts
import { SKELETON_IMPORTS } from '@ethlete/components';
```

<StoryEmbed id="components-skeleton--default" height="420px" />

## Usage

```html
<et-skeleton>
  <div class="flex items-center gap-3">
    <et-skeleton-item shape="circle" style="--et-skeleton-size: 40px" />
    <et-skeleton-text lines="2" />
  </div>
  <et-skeleton-item shape="rect" style="block-size: 140px" />
</et-skeleton>
```

| Component          | What it is                                                                                   |
| ------------------ | -------------------------------------------------------------------------------------------- |
| `et-skeleton`      | The container: `role="status"`, `aria-busy`, the shimmer switch, and the gap between shapes. |
| `et-skeleton-item` | One shape. `aria-hidden` - the container's text is the announcement.                         |
| `et-skeleton-text` | A paragraph of lines, the last one short.                                                    |

### Container inputs

| Input             | Default  | Description                                            |
| ----------------- | -------- | ------------------------------------------------------ |
| `loadingAllyText` | `null` ¹ | What a screen reader announces in place of the shapes. |
| `animated`        | `true`   | Run the shimmer. Off leaves the same shapes static.    |

¹ `null` falls through to [`LOADER_LABELS.loadingContent`](/components/localization) (`'Loading…'`).

### Shapes

| `shape`    | Sizing                                                                                                |
| ---------- | ----------------------------------------------------------------------------------------------------- |
| `'text'`   | **Default.** A line of text's height (`em`-based), inline, so it flows inside copy without moving it. |
| `'rect'`   | Full width, height and radius from your CSS - a card, an image, a chart.                              |
| `'circle'` | `--et-skeleton-size` square and round - an avatar.                                                    |

`et-skeleton-text` takes `lines` (default `3`) and `lastLineWidth` (default `60`%); a
full-width last line reads as a block rather than a paragraph.

## Custom properties

| Property                 | Default  | Applies to                        |
| ------------------------ | -------- | --------------------------------- |
| `--et-skeleton-size`     | `1em`    | `circle` diameter, item height    |
| `--et-skeleton-radius`   | `4px`    | corner radius of `text` / `rect`  |
| `--et-skeleton-gap`      | `8px`    | gap between shapes and text lines |
| `--et-skeleton-duration` | `1400ms` | one shimmer sweep                 |

## Motion

The shimmer is **omitted, not paused**, under `prefers-reduced-motion: reduce` - a static
placeholder still says "loading" without anything moving. `animated="false"` is the
independent off-switch, for a placeholder inside something that already animates or a long
list where a sweep per row is noise.

<StoryEmbed id="components-skeleton--static" height="420px" />

## In a table

`<et-table>` renders its own placeholder rows from these bones while
[loading with no rows yet](/components/table#loading-error-states) - one `shape="text"`
item per column, which is what keeps a placeholder row the height of a row of text.
Nothing to wire up: bind `loading`.
