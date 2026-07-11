# Rich filter

A scroll-aware scaffold for filter UIs: it watches your inline filter area with intersection observers and sets state classes on the host, so a floating filter button can appear once the inline filters scroll out of view — and `scrollToTop()` brings the user back.

```html
<div #host et-rich-filter-host>
  <!-- page content above the filters -->

  <et-rich-filter-button-slot etRichFilterTop>
    <button (click)="host.scrollToTop()" etRichFilterButton>Filter</button>
  </et-rich-filter-button-slot>

  <ul etRichFilterContent>
    <!-- the filterable list / filter controls -->
  </ul>

  <!-- more content -->
</div>
```

```ts
import { RichFilterImports } from '@ethlete/cdk';
```

<StoryEmbed id="cdk-filters-rich-filter--default" height="480px" />

## Building blocks

| Piece                                           | Purpose                                                                                        |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `et-rich-filter-host` / `[et-rich-filter-host]` | The scaffold; observes the slots and emits the state classes. Exposes `scrollToTop(options?)`. |
| `et-rich-filter-button-slot`                    | Marks where the filter button lives inline; its viewport visibility is tracked.                |
| `[etRichFilterButton]`                          | The button itself — this is the element the CSS turns into a floating button.                  |
| `[etRichFilterContent]`                         | The filterable content area; its visibility is tracked too.                                    |
| `[etRichFilterTop]`                             | The scroll anchor `scrollToTop()` targets (defaults to the host itself).                       |

## How the state classes work

For both the button slot and the content, the host emits five classes: `et-rich-filter-host-button--is-visible` / `--is-above` / `--is-below` / `--is-left` / `--is-right` (and the same with `-content-`). The shipped CSS uses them like this: once the button slot has scrolled out above while the content is still on screen, `.et-rich-filter-button` becomes `position: fixed` in the bottom-right corner and scales in; once the content has scrolled past as well, it scales back out. You can build entirely different behavior on the same classes.

## Styling

The floating position and layering are customizable via `--et-rich-filter-button-inset-inline-end` / `--et-rich-filter-button-inset-block-end` (both 30px) and `--et-rich-filter-button-z-index` (10). Everything else about the button's appearance is up to you.
