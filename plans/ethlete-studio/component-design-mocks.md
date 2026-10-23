# Component design mocks for Ethlete Studio

Status: slice 1 done.

## Goal

A design call imports ready-made mocks of `@ethlete/components` (button, form field, select, …),
uses them as they are, wraps them, or copies one into the call and changes it.

## Decisions (Tom agreed on 2026-10-23)

1. A mock is a framework-free function per component - `button({ label, size, variant })`,
   `select({ value, open, options })` - that returns the same DOM and `et-` classes the Angular
   component renders, as an `html` string (the `@design-explore` drawing model). No Angular.
2. A mock uses the real component CSS, never a copy. Component CSS is plain global `et-` CSS, so
   it works without Angular.
3. Themes come from a pure function that turns the app's `SurfaceTheme[]` and `ColorTheme[]` into
   static CSS - the same output `provideSurfaceThemesWithTailwind4` /
   `provideColorThemesWithTailwind4` build at runtime. Share one implementation, so the two can not
   drift.
4. The mocks ship with `@ethlete/components`, one file per mock next to the design entry, so a
   mock and its component have one version. A mock never imports the `@ethlete/*` barrels (in this
   repo they resolve to source, and one barrel makes a frame request the whole lib).
5. Drift guard: per mock, a spec renders the real component and the mock and compares the class
   structure. A markup change in the component fails it.
6. Each mock takes slot HTML, `class` and `style`, so a call can wrap it and add CSS on top.

## Packaging (decided in the slice 1 spike, 2026-10-23)

The candidate works; the fallback (a generated `design.css`) is not needed.

- A lib ships its mocks as TS source in `design/`, with `"exports": { "./design/*": "./design/*.ts" }`
  in its source `package.json`. ng-packagr merges that entry into the generated exports.
- `ng-package.json` copies `design/**/*.ts` to `./design` and `src/lib/**/*.css` to `./src/lib`, so a
  mock imports `../src/lib/<x>/<x>.component.css?inline` by the same relative path in this repo and
  in the package. That ships all component CSS: about 690 kB raw, 120 kB gz, for components.
- A mock reaches another lib only through its design entry (`@ethlete/core/design/interactive-styles`),
  never a barrel.
- This repo needs no `tsconfig.base.json` path: `node_modules/@ethlete/*` links to `libs/*`, and both
  tsc and Vite read the exports map through it.
- Studio: `optimizeDeps.exclude` lists `@ethlete/components` and `@ethlete/core`, and the calls tsconfig
  includes `libs/cli/design/css-inline.d.ts`, which types `*.css?inline`. The exclude went in up
  front and was never tried without it.
- Proven: `design check --tsconfig --call components/button-mock/00-on-two-surfaces` prints `ok` here
  and in a scratch consumer (packed `core` and `components` tarballs, `npm install --legacy-peer-deps`,
  served with `DE_PORT=4499 node dist/libs/cli/src/index.js design --checkout <dir>`). Computed styles
  of the drawn buttons matched in both.
- Theme CSS: the providers build no CSS. The `tailwind-4-surface-theme` and `tailwind-4-color-theme`
  generators do. Their CSS bodies moved to `libs/core/design/theme-css.ts`; the generators keep only
  the header and import it as `../../design/theme-css.js`. The generators' tsconfig `rootDir` is now
  `..`, so their output lands in `generators/dist/{generators,design}`, and `ng-package.json` maps
  both. Generator output is byte-identical to before, for prefix `et` and a custom prefix.
- Dead end: listing `../design/**/*.ts` in the generators' tsconfig also compiled `interactive-styles.ts`,
  whose `?inline` import tsc can not type. The generators pull in `theme-css.ts` by import only.

## How a mock is built (copy this for the next one)

- `libs/components/design/button.ts`: `button(options)` returns an HTML string, and `buttonStyles` is the
  real CSS of every stylesheet the component and its host directives mount.
- `libs/components/src/lib/button/button.design.spec.ts`: renders the component in TestBed and the mock,
  and compares tag, sorted classes, `data-*`/`aria-*`/`disabled`/`type` attributes and children.
  Proven to fail when the mock's markup changes.
- Read the real DOM first: a throwaway spec that logs `fixture.nativeElement.innerHTML`.

## Slices

1. Done: packaging spike, `themeCss()`, the button mock, the form field and select mocks, their
   drift specs, and the demo calls `components/button-mock/00-on-two-surfaces` and
   `components/form-mock/00-field-and-select`.
   - `formField({ control, label, hint, error, errorColor, … })` takes a control object, from
     `input()` or `select()`. The field passes its state (disabled, required, error, focus, open,
     ids) to the control, so a call sets each flag once.
   - Theme names are options: `errorColor` (the counter always carries it, so pass it even without
     an error) and the select's `panelColor` (the app's default color theme).
   - `open: true` draws the select panel in a mock-only `.et-design-panel-anchor` wrapper below
     the whole field, also below its messages.
   - The mocks carry copies of the icon SVGs, because the package ships no `src/lib` TS. The
     select spec checks them against `CHECK_ICON`, `CHEVRON_ICON` and `TIMES_ICON`.
   - The `et-label` styles moved from inline `styles` to `label.directive.css`, so a mock can import them.
   - Shared drift helper: `src/lib/testing/design-mock-shape.ts`. It compares id references
     (`aria-labelledby`, …) by count only.
   - Not drawn: textarea, counter, warnings, busy spinner, multiple select, chips.
2. More mocks, by what calls ask for.
3. Docs page and the `ethlete-design-exploration` skill name the mocks.
