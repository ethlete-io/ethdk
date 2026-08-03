# Masonry

`et-masonry` packs variable-height items into columns, placing each item into the currently shortest column.

::: warning Superseded by @ethlete/components
New code should use the [components masonry](/components/masonry) (`MASONRY_IMPORTS`). It ships as
directives (`etMasonry` / `etMasonryItem`) you put on your own elements, so the markup can be a real
`<ul>`/`<li>` list; `columWidth` becomes `columnWidth` (and both it and `gap` accept a breakpoint map);
items need no `key`; and the `initializing` / `initialized` outputs become an `isSettled()` signal to gate
infinite-scroll fetches on. This page documents the CDK version, which still receives bug fixes.
:::

```html
<et-masonry [columWidth]="200" [gap]="16">
  @for (item of items; track item.id) {
  <et-masonry-item [key]="item.id">
    <!-- arbitrary content -->
  </et-masonry-item>
  }
</et-masonry>
```

```ts
import { MasonryImports } from '@ethlete/cdk';
```

<StoryEmbed id="cdk-masonry--default" height="480px" />

## Options

| Input                                  | Default | Purpose                                                                                                                     |
| -------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------- |
| `columWidth` (sic)                     | `250`   | Target column width in px; the column count is `floor(containerWidth / columWidth)` and the actual width stretches to fill. |
| `gap`                                  | `16`    | Gap between columns and items in px.                                                                                        |
| `key` (on `et-masonry-item`, required) | -       | Identity of the item - changing keys drives re-positioning.                                                                 |

Outputs `initializing` / `initialized` fire while items are being (re)positioned and once everything is placed.

## Behavior

Items are absolutely positioned via transforms, so reflows don't relayout the document. Appending items (e.g. infinite scrolling) only positions the new ones - existing items stay where they are; a container resize or a `columWidth`/`gap` change triggers a full reflow. The initial paint is unanimated; once the host has the `et-masonry--initialized` class, later moves transition smoothly. Items fade in when first positioned.

## Styling

The actual column width is published as `--et-masonry-column-width`. Style items via `et-masonry-item`; the host exposes `et-masonry--initialized` and (briefly, during resizes) `et-masonry--hide-overflow`.
