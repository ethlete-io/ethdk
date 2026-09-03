# Component behavior tests (Playwright against Storybook)

Status: in progress (started 2026-09-03). Delete this file when the project, the helpers and the
first suites are merged and the `component-behavior-tests` skill documents them.

## Why

The `libs/components` vitest specs run in jsdom. jsdom has no layout, no `:focus-visible`
styling, no real keyboard event routing across shadow/portal boundaries, and no touch. A
refactor can break the focus ring, the arrow-key order in a menu, or the touch sheet of a select,
and every unit spec stays green. The `verify-in-storybook` skill drives real stories headlessly,
but only by hand and only once.

This project makes those checks permanent. Each suite opens a **real Storybook story** in
Chromium, once as a desktop pointer user and once as a touch device, and asserts on what the
browser computes: the focused element, its computed outline, the DOM after a key press, the
overlay that a tap opens.

## Layout

```
apps/storybook-e2e/
  project.json              # Nx project, tags type:e2e scope:components, target `e2e`
  playwright.config.ts
  tsconfig.json
  eslint.config.mjs
  src/
    support/
      story.ts              # openStory(page, id, { args, globals }), storyUrl()
      focus.ts              # expectFocusVisible, focusedDescriptor, tabSequence
      keyboard.ts           # press helpers with settle
      touch.ts              # tap helpers, expectTouchMode
      index.ts
    button/button.e2e.ts
    tabs/tabs.e2e.ts
    menu/menu.e2e.ts
    select/select.e2e.ts
    ...
```

Mirror `apps/timetrack-e2e` for the Nx wiring (`@nx/playwright:playwright` executor, `e2e`
target, `implicitDependencies: ["storybook"]`).

## Playwright config

```ts
const url = process.env['STORYBOOK_URL']; // e.g. http://localhost:4400 (the dev server)
const BASE_URL = url ?? 'http://localhost:4401';

export default defineConfig({
  testDir: './src',
  testMatch: '**/*.e2e.ts',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  reporter: process.env['CI'] ? 'dot' : 'list',
  use: { baseURL: BASE_URL, trace: 'on-first-retry' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'touch', use: { ...devices['Pixel 7'] } }, // hasTouch, isMobile, coarse pointer
  ],
  webServer: url
    ? undefined
    : {
        command: 'node apps/storybook-e2e/serve-static.mjs dist/storybook 4401',
        url: BASE_URL,
        reuseExistingServer: true,
        timeout: 60_000,
        cwd: '../..',
      },
});
```

- `serve-static.mjs` is a dependency-free Node static server (`http` + `fs`) with an
  `index.html` fallback. No new npm package.
- The Nx `e2e` target `dependsOn: [{ projects: ['storybook'], target: 'build-storybook' }]`, so
  `npx nx e2e storybook-e2e` builds Storybook once (Nx caches it) and serves `dist/storybook`.
- Local iteration: `STORYBOOK_URL=http://localhost:4400 npx nx e2e storybook-e2e -- --project=desktop apps/storybook-e2e/src/tabs`
  uses the running dev server and skips the build.
- Only Chromium. WebKit/Firefox are follow-ups; the `verify-on-apple-devices` skill covers iOS.
- Confirm how the touch project maps to the SDK's touch detection: grep `libs/core` and
  `libs/components` for the media query or capability check the components use (`pointer: coarse`,
  `hover: none`, `maxTouchPoints`) and assert in `touch.ts` that the emulated device satisfies it.
  If it does not, extend the `touch` project `use` block (`contextOptions`, `viewport`) until it does.

## Helpers

- `openStory(page, id, opts?)`: navigates to `/iframe.html?id=<id>&viewMode=story` (append
  `&args=key:value;key2:value2` and `&globals=` when given), waits for `#storybook-root` to contain
  an element, and waits for `document.fonts.ready`. Returns the root locator. Fails with a clear
  message if Storybook answers with its "story not found" page.
- `expectFocusVisible(locator)`: asserts `locator` is `document.activeElement`, matches
  `:focus-visible`, and its computed `outline-style` is not `none` **or** its `box-shadow` is not
  `none`. This is the regression net for "the focus ring disappeared".
- `focusedDescriptor(page)`: `{ tag, role, name, testId, text }` of the active element, for
  readable tab-order assertions.
- `tabSequence(page, n)`: press Tab `n` times and collect descriptors.
- `expectTouchMode(page)`: evaluates the same check the SDK uses (see above) and asserts true.
- Story ids come from `title` + export name (`Components/Tabs/Inline` → `components-tabs-inline--default`).
  List them from `<BASE_URL>/index.json` when unsure (see `verify-in-storybook`).

## Suites

Each suite has three describe blocks where they apply: `focus`, `keyboard`, `touch`. Use
`test.skip(({ isMobile }) => !isMobile)` to run a touch block only in the `touch` project and the
inverse for pointer-only behavior.

Pilot (this change):

1. **button** - Tab reaches the button, focus is visible, Space/Enter activate, disabled skips focus.
2. **tabs** - ArrowLeft/ArrowRight move the active tab (or focus, depending on the activation
   mode the story uses), Home/End jump, the panel follows, focus ring visible on the tab.
3. **menu** - opens on click/Enter, ArrowDown/ArrowUp cycle, Escape closes and returns focus to
   the trigger, typeahead moves focus; on touch a tap opens it and the menu renders as its touch
   variant if the component has one.
4. **select** - keyboard open/close/select; on touch the tap opens the component's touch
   presentation (sheet or native), and the chosen option becomes the value.

Read the component's story file and its docs page under `apps/docs/components/` before writing
the suite - the doc page states the intended keyboard contract. Assert the contract, not the
current behavior. If the current behavior contradicts the doc, keep the test, mark it
`test.fail()` with a one-line reason, and report it. Do not change `libs/components`.

## Running

```bash
npx nx e2e storybook-e2e                                              # build + all suites, both projects
STORYBOOK_URL=http://localhost:4400 npx playwright test -c apps/storybook-e2e/playwright.config.ts apps/storybook-e2e/src/menu
```

Agents scope their runs to their own suite. The coordinator runs the full project once.

## Findings (from the suite agents, 2026-09-03)

- `button`, `tabs`: 14 tests, all pass on the dev server and on the static build.
- `dialog` (overlay: `components-overlays-overlay--default`, dialog + bottom sheet) and `slider`:
  16 tests, all pass twice, no `test.fail()`. Local helpers `waitForEntered` (gates on
  `et-animation-enter-done`) and `touchSwipe`/`touchDrag` (CDP `Input.dispatchTouchEvent`) live in
  the suites; promote them into `support/` when a third suite needs them. Programmatic initial focus
  is not `:focus-visible` in Chromium after a pointer interaction, so that case asserts focus only.
- `select` (13) + `cascader` (11): 24 pass on the static build, 1 `test.fail()`. Form controls draw
  their focus ring on `.et-form-field-control-frame` (border color via `:has(:focus-visible)`), not on
  the focused element, so `expectFocusVisible` cannot apply; `support/focus.ts` now has
  `expectFieldFocusVisible(control)`, which compares the frame's computed border/outline/shadow with
  and without focus (it yields two frames and awaits the frame's animations, because the field's
  focused state lands on Angular's next tick and the border color transitions). The select opens with
  the first option already active, so ArrowDown+Enter commits the second option; the suite asserts
  that. Drill tests await the focused node before the next key, otherwise they flake under load.
  BUG (`test.fail()`): in the touch sheet, tapping a parent node drills but `document.activeElement`
  falls back to `<body>`; the child only carries `[data-focused]`. Docs promise "drilling in the mobile
  sheet moves focus into the new level".
- `menu` (17) + `tooltip` (5): 22 pass twice, no `test.fail()`. Overlays render outside
  `#storybook-root`, so overlay queries use `page.getByRole`, not `root`. Menu items show focus with
  `[data-active]` (CSS sets `outline: none` on purpose), so the suite has a local
  `expectItemFocusVisible`; a mouse-opened menu is not `:focus-visible`. A tap never shows a tooltip.
  Warning: `nx lint storybook-e2e --fix` twice mangled a `getAttribute` + `toBeTruthy` pattern in
  `tooltip.e2e.ts` into broken syntax (eslint-plugin-playwright autofixer). Run lint without `--fix`
  on this project, or re-check the file after a fix.
