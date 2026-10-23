# Component design mocks for Ethlete Studio

Status: slice 1 in progress.

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

## Open question for slice 1 (spike first)

ng-packagr inlines component styles into the JS, so the published package has no `.css` files, and
ng-packagr can not build a module that imports `?inline` CSS. Studio's Vite runs against consumer
checkouts (`libs/cli/src/lib/design/serve.ts`), where `@ethlete/components` comes from npm.
Candidate: ship the mocks as TS source plus the component CSS as package assets
(`design/`, an `exports` entry `./design/*`), resolved by Studio's Vite (exclude it from
`optimizeDeps`), with a `tsconfig.base.json` path in this repo. Prove it on a packed tarball in a
scratch consumer before building more mocks. If it fails, the fallback is a generated
`design.css` that a project lists under `styles` in `.ethlete/design/config.json`.

## Slices

1. Spike the packaging; theme CSS function; mocks for button, form field and select; drift specs;
   one demo call under `.ethlete/design/calls/components/`.
2. More mocks, by what calls ask for.
3. Docs page and the `ethlete-design-exploration` skill name the mocks.
