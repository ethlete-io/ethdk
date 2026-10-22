# Copyable code examples on the docs site

## Problem

A consumer cannot get useful code from the docs. Each docs embed is a Storybook iframe, and each
story renders a Storybook host component (`<et-sb-form-field-select-country />`). Storybook's code
panel shows only that tag. The host components also hold Storybook-only code: Tailwind layout
classes, `et-sb-` selectors, wrapper markup.

## Decision

Examples are their own files, written to be copied. The docs site renders each one live and shows
its source next to it. Storybook stays as it is; it is not the example source.

## Design

- **App:** `apps/docs-examples`, an Angular app built with `@angular/build:application` (like
  `apps/csp`). One page, `index.html?id=<example-id>`, renders one example. The query parameter
  avoids a hosting rewrite.
- **Example files:** `apps/docs-examples/src/examples/<domain>/<name>.example.ts`, plus an
  optional `<name>.data.ts` for long demo data. One standalone component per file.
- **Registry:** `src/examples/<domain>/index.ts` maps an id to a lazy `import()`. The app merges the
  domain maps.
- **Rules for an example file:**
  - Import only from public `@ethlete/*` entry points, as a consumer does.
  - No Tailwind, no `et-sb-` selectors, no Storybook wrapper markup. Plain inline styles only where
    the layout needs them.
  - Theme names come from the examples app config, which registers them as a consumer app does.
  - Self-contained: a reader can paste the file into an app and it compiles.
- **Docs syntax:** one line in a guide, for example `@example select/select-country`. A Vite plugin
  in the docs config (`enforce: 'pre'`, `.md` files) expands it into an `<Example>` Vue component
  (live iframe) plus a VitePress `::: code-group` with the example file and its data file. VitePress
  highlights the code at build time, and `vitepress-plugin-llms` sees the code in `llms.txt`.
- **Hosting:** the docs build copies the examples build into `dist/apps/docs/examples/`, so the
  iframe is same-origin in production. Local dev runs the examples dev server on `:4403`.
- **CI:** the docs job builds `docs-examples` first. The app gets `lint` and `typecheck` targets.

## Slices

1. Infrastructure: the app, the registry, the Vite plugin, `<Example>`, hosting, CI, the `docs`
   skill update. Examples for `select` only, and `apps/docs/components/select.md` switches to them.
2. One slice per docs guide in `apps/docs/components/`, replacing `<StoryEmbed>` with `@example`.
   Order by consumer demand: forms first, then overlays, menu, table.

## Open questions

- Should stories later render the example components, so a demo exists only once?

## Status

- Slice 1: done. `apps/docs-examples` + `@example` plugin ship; `components/select.md` uses nine examples (incl. country flags).
- Slice 2 (forms): done. One guide per run, in this order: forms, text-inputs, choice-inputs,
  date-time-inputs, time-picker, calendar, cascader, slider, dropzone, rich-text-editor.
  Done: forms, text-inputs, choice-inputs, date-time-inputs, time-picker, calendar, cascader, slider,
  dropzone, rich-text-editor.
- Slice 3 (other `components/` guides), one batch per run, in this order:
  1. Overlays: overlays, overlay-openers, menu, tooltip, toggletip, filter-overlay, command-palette,
     notification.
  2. Table: table, pagination, paged-query-trigger.
  3. Actions and display: button, chip, copy-button, floating-action, kbd, badge, avatar, banner,
     card, empty-state, divider, description-list, icon, mixed-state, loader, skeleton.
  4. Navigation: accordion, breadcrumb, tabs, toolbar, progress-steps, tree.
  5. Layout and content: carousel, masonry, grid, scrollable, scrollbar, picture, timeline, stream,
     query-error.
  6. Charts: chart, line-chart, pie-chart, sankey-chart, stat-tile.
  7. Sport: bracket, bracket-prediction, bracket-rounds-list, match, standings, standings-pick,
     sport-recipes, scheduler.
     Done: none yet.
- Out of scope for now: `cdk/` (maintenance mode), `query/`, `query-devtools/`, `contentful/`.
