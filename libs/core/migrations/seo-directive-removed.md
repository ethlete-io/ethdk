# Replace `SeoDirective` with the `apply*Binding` functions

`SeoDirective` and its `SeoConfig` types were removed in `@ethlete/core` v5. The directive wrote to
`document` directly, so it never worked under server rendering, and it held one config object per
component, so a child route could only override a parent by re-declaring the whole config.

No codemod can do this rewrite: an Observable value becomes a signal, and one config key becomes one
function call. Both are decisions about the call site.

## What to change

1. Find every component that injects `SeoDirective` or lists it in `hostDirectives` or `imports`.
2. Remove the directive from the component.
3. Replace the `updateConfig({ … })` call with one `apply*Binding` call per key it set.
4. Turn an Observable value into a signal: `toSignal()` at the edge of the component, or a
   `computed()` over a signal that is already there.
5. Import each `apply*Binding` function from `@ethlete/core`.

## The replacement for each key

| `SeoConfig` key              | Replacement                                                   |
| ---------------------------- | ------------------------------------------------------------- |
| `title`                      | `applyHeadTitleBinding`                                       |
| `description`                | `applyDescriptionBinding`                                     |
| `keywords`                   | `applyKeywordsBinding`                                        |
| `robots`                     | `applyRobotsBinding` (takes a directive object, not a string) |
| `icon`                       | `applyLinkBinding({ rel: 'icon', href })`                     |
| `themeColor` / `colorScheme` | `applyMetaBinding({ name: 'theme-color' \| 'color-scheme' })` |
| `canonical`                  | `applyCanonicalBinding`                                       |
| `alternate`                  | `applyAlternateBinding` / `applyAlternateLanguagesBindings`   |
| `og`                         | `applyOpenGraphBindings`                                      |
| `twitter`                    | `applyTwitterCardBindings`                                    |
| `facebook`                   | `applyOpenGraphBindings` (Facebook reads Open Graph)          |
| any other key                | `applyMetaBinding({ name, content })`                         |

## Example

```ts
// before
@Component({ hostDirectives: [SeoDirective] })
export class ArticleComponent {
  private seo = inject(SeoDirective);

  constructor() {
    this.seo.updateConfig({
      title: this.article$.pipe(map((a) => a.title)),
      description: 'A brief description',
      canonical: 'https://example.com/article',
      og: { image: 'https://example.com/image.jpg' },
    });
  }
}

// after
@Component({})
export class ArticleComponent {
  private article = toSignal(this.article$);

  constructor() {
    applyHeadTitleBinding(computed(() => this.article()?.title ?? ''));
    applyDescriptionBinding('A brief description');
    applyCanonicalBinding('https://example.com/article');
    applyOpenGraphBindings({ images: ['https://example.com/image.jpg'] });
  }
}
```

## Two things to watch

- A child component no longer re-declares its parent's config to override one key. Title parts
  compose through the title store, and duplicate meta and link tags are deduplicated by selector.
  Delete a re-declaration instead of porting it.
- `robots` took a string and now takes a directive object, for example `{ index: true, follow: true }`.

## When you are done

Nothing may import `SeoDirective` or `SeoConfig` any more. Run the type check and the lint task of
every project you changed.

The full guide, with every binding and its options, is at <https://ethlete-sdk-docs.web.app/core/seo>.
