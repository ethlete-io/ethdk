# Pagination

`et-pagination` renders an accessible page-link list from a total page count and a `FormControl` holding the current page. Beyond the UI it can manage SEO head tags for paginated pages.

```html
<et-pagination [pageControl]="pageControl" [totalPages]="totalPages" />
```

```ts
import { PaginationImports } from '@ethlete/cdk';

@Component({ imports: [PaginationImports] })
export class ProductListComponent {
  pageControl = new FormControl<number | null>(1);
  totalPages = 12;
}
```

<StoryEmbed id="cdk-pagination--default" height="180px" />

Navigation happens through the control: clicking a page calls `pageControl.setValue(page)`, so your data loading just reacts to `pageControl.valueChanges` (pages are 1-based).

## Options

| Input                    | Default        | Purpose                                                                    |
| ------------------------ | -------------- | -------------------------------------------------------------------------- |
| `pageControl` (required) | -              | `FormControl<number \| null>` with the current page.                       |
| `totalPages` (required)  | `0`            | Total number of pages.                                                     |
| `renderAs`               | `'links'`      | Render items as `<a href>` (with `?page=N` URLs) or as `'buttons'`.        |
| `pageChangeScrollAnchor` | `null`         | Element scrolled into view after a page change (e.g. the top of the list). |
| `ariaLabel`              | `'Pagination'` | The `aria-label` of the wrapping `<nav>`.                                  |

The list always shows first/previous/next/last hot links plus the current page with two neighbors on each side; every item carries a descriptive `aria-label` and the current page is marked with `aria-current="page"`.

## SEO head tags

For paginated listing pages the component can keep the document head in sync with the current page:

| Input                 | Default | Purpose                                                                                                                       |
| --------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `headTitleTemplate`   | `null`  | Document-title template; must contain the `%s` placeholder, which is replaced with the page number (e.g. `'Shop – Page %s'`). |
| `headFirstPageTitle`  | `null`  | Title used verbatim on page 1 instead of the template.                                                                        |
| `headAddCanonicalTag` | `false` | Write a `<link rel="canonical">` pointing at the URL without the `page` query param (removed again on destroy).               |

## Styling

The component ships no visual CSS. Style against `et-pagination-nav`, `et-pagination-list`, `et-pagination-list-item` and `et-pagination-anchor` (`--link` / `--button` modifiers), plus per-item type classes like `et-pagination-current`, `et-pagination-first`, `et-pagination-previous`, `et-pagination-page-number-far` and `et-pagination-item-disabled`.
