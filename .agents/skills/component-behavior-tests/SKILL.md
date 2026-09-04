---
name: component-behavior-tests
description: Add or run the permanent Playwright suites in apps/storybook-e2e that drive real Storybook stories in Chromium - focus visibility, keyboard navigation, and touch mode. Use after changing a component's focus, keyboard, pointer, overlay or touch behavior, when a refactor touches libs/components broadly, or when the user says "behavior test", "e2e for the component", "focus ring", "keyboard nav", "touch mode".
---

# Component behavior tests (Playwright against Storybook)

The vitest specs in `libs/components` run in jsdom. jsdom has no layout, no `:focus-visible`
styling, no real keyboard routing across portals, and no touch. The suites in
`apps/storybook-e2e` open a real story in Chromium, once as a desktop pointer user and once
as a touch device (`Pixel 7`), and assert what the browser computes. Treat them as the
regression net for "the focus ring disappeared", "arrow keys stopped working", "the touch
sheet does not open".

## Run

```bash
# against the dev Storybook on :4400 (no build), one suite, both projects
STORYBOOK_URL=http://localhost:4400 npx playwright test -c apps/storybook-e2e/playwright.config.ts apps/storybook-e2e/src/menu

# one project only
STORYBOOK_URL=http://localhost:4400 npx playwright test -c apps/storybook-e2e/playwright.config.ts --project=touch apps/storybook-e2e/src/select

# what CI runs: build Storybook, serve dist/storybook, run everything
npx nx e2e storybook-e2e
```

Check the dev server first: `curl -s -o /dev/null -w "%{http_code}" http://localhost:4400/`.
When several agents share one dev server, pass `--workers=2`. A test that passes with
`--workers=1` and fails in parallel is a shared-server flake, not a component bug; rerun
before you report it.

When the dev server loops (`[HMR] Cannot find update ... Reloading page` on every load), run
against the static build instead: `npx nx build-storybook storybook`, then run Playwright with
`STORYBOOK_URL` unset. The config serves `dist/storybook` on `:4401` by itself. Tailwind's
`source()` in `apps/storybook/src/styles/storybook.css` is limited to `libs` and
`apps/storybook/src` for this reason: a wider scope makes webpack watch `test-results/` and
`.nx/`, so every test failure and every lint run rebuilds Storybook. Concurrent runs delete each
other's results; pass `--output=apps/storybook-e2e/test-results/<domain>` per run.

## Layout

```
apps/storybook-e2e/src/
  support/        openStory, expectFocusVisible, expectFieldFocusVisible, focusedDescriptor, tabSequence, pressKey, tap, touchDrag, touchSwipe, expectTouchMode
  <domain>/<domain>.e2e.ts
```

One file per component domain. Three describe blocks where they apply:

```ts
test.describe('menu / keyboard', () => {
  test.skip(({ isMobile }) => isMobile, 'pointer-only');
  ...
});

test.describe('menu / touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch-only');
  ...
});
```

## Write a suite

1. Read the component's page under `apps/docs/components/` first. It states the keyboard and
   touch contract. Assert the contract, not the current behavior.
2. Find the story id from `<BASE_URL>/index.json` (title + export name, e.g.
   `components-navigation-tabs-tabs--default`). Pass story args through
   `openStory(page, id, { args: { disabled: true } })`.
3. Use the helpers: `expectFocusVisible(locator)` checks `:focus-visible` plus a computed
   outline or box-shadow; `expectFieldFocusVisible(control)` is the variant for form controls,
   whose ring is the border of the surrounding `.et-form-field-control-frame`;
   `focusedDescriptor(page)` and `tabSequence(page, n)` make tab-order assertions readable; `tap(locator)` for touch; `expectTouchMode(page)` asserts the SDK's own
   check, `(pointer: coarse)` from `injectHasTouchInput`.
4. Prefer `expect(locator).toBeFocused()` and other auto-retrying assertions over sleeps. A
   `pressKey` already waits a short settle. Add a `waitForTimeout` only for a negative
   assertion ("nothing happened"), and keep it small.
5. When the component contradicts its docs, keep the test and mark it
   `test.fail()` with a one-line reason. Report it; do not bend the assertion.
6. Format and lint: `npx prettier --write <files>`, then `npx nx lint storybook-e2e` without
   `--fix` (the Playwright autofixer mangles code). Fix findings by hand.

## What belongs here, what does not

- Here: focus visibility and order, keyboard contracts, overlay open/close and focus restore,
  touch presentation and gestures, anything that needs layout or a real event pipeline.
- Not here: value logic, signal state, input validation - those stay in the vitest specs.
  Pixel screenshots are not used; computed styles are deterministic across machines,
  screenshots are not.
- The `verify-in-storybook` skill is the one-off exploration tool. When a check from that
  session is worth keeping, move it into a suite here.
