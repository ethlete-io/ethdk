---
name: sdk-docs
description: Where the @ethlete SDK is documented and how to find the right page. Read BEFORE using any @ethlete component, directive or API you have not already used in this repo - the docs site and Storybook are the source of truth, and inputs/outputs must never be guessed from a component's name.
kind: skill
scope: consumer
vars: [docsBaseUrl, sdkStorybookUrl]
---

# Finding the @ethlete SDK docs

The SDK lives in another repository. Its source is **not** in this project, so the only
reliable way to learn a component's inputs, outputs, defaults or required directives is
to read its documentation - never infer an API from the name, and never copy a shape
from an unrelated component.

Two sources, both authoritative for different things:

| Source        | URL                 | Use it for                                                                                       |
| ------------- | ------------------- | ------------------------------------------------------------------------------------------------ |
| **Docs site** | {%docsBaseUrl%}     | Prose guides: what a thing is for, options, defaults, behaviour, migration notes                 |
| **Storybook** | {%sdkStorybookUrl%} | The live component: every variant rendered, the real controls, and the exact markup a story uses |

## Finding the right page

Page URLs follow `{%docsBaseUrl%}/<lib>/<topic>`. The library sections:

| Section                                        | Covers                                                                                                                                                                               |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/components/`                                 | The active UI library - one guide per domain (see the list below)                                                                                                                    |
| `/core/`                                       | Framework primitives: `theming`, `overlay-runtime`, `signal-utils`, `element-signals`, `animations`, `scrolling`, `drag-resize`, `directives-pipes`, `providers`, `seo`, `utilities` |
| `/query/`                                      | Data fetching - see the dedicated {%skill:query%} guide first                                                                                                                        |
| `/cdk/`                                        | The predecessor UI toolkit, maintenance mode. Only for code that still uses it                                                                                                       |
| `/contentful/`, `/cli/`, `/eslint/`, `/types/` | The remaining packages                                                                                                                                                               |

Component domains under `/components/`:

`accordion` `bracket` `bracket-rounds-list` `breadcrumb` `button` `calendar` `carousel`
`cascader` `chip` `choice-inputs` `date-time-inputs` `dropzone` `error-codes`
`filter-overlay` `floating-action` `focus-ring` `forms` `grid` `icon` `loader`
`localization` `masonry` `match` `menu` `mixed-state` `notification` `overlay-openers`
`overlays` `pagination` `picture` `query-devtools` `query-error` `rich-text-editor`
`scrollable` `select` `skeleton` `slider` `sport-recipes` `standings` `stream` `table`
`tabs` `text-inputs` `time-picker` `toggletip` `tooltip`

So the table guide is `{%docsBaseUrl%}/components/table`, the menu guide
`{%docsBaseUrl%}/components/menu`, and so on. When a name isn't in that list, start at
`{%docsBaseUrl%}/components/` and follow the sidebar rather than guessing a URL.

## How to use them

- **Read before writing.** Fetch the guide for the domain you are about to touch. A
  component's required host directives, its two-way models, and which imports array to
  pull in (`MENU_IMPORTS`, `TABLE_IMPORTS`, …) are all things the docs state and the
  name does not imply.
- **Storybook shows the real thing.** When the prose is ambiguous about markup or a
  variant's look, open the story - the source panel is the exact template that renders it.
- **Match the docs to your installed version.** Check the `@ethlete/*` versions in
  `package.json`. The main docs and Storybook track the released line; a repo on
  `-next` prereleases should read `{%docsBaseUrl%}` and `{%sdkStorybookUrl%}` only if
  they are the matching prerelease deployments, otherwise expect drift and verify
  against the installed `.d.ts` in `node_modules/@ethlete/<lib>`.
- **`node_modules` is the tiebreaker.** If the docs and the installed package disagree,
  the installed type definitions win - report the drift rather than working around it.
- **Never treat a `subtle` namespace as public API.** Anything exposed under `subtle` is
  an unsupported escape hatch that can change without a major version.

## Related

- Data fetching has its own guide: {%skill:query%}
- Theming tokens and how to register themes: {%skill:theming%}
