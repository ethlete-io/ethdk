---
name: verify-in-app
description: Verify a UI change in the running app by driving it headlessly with Playwright - screenshots, computed styles, pointer and cursor state - and prove a fix with a test that fails without it. Use whenever you change a view, a component or its styles and need to confirm what renders, not just that it compiles.
kind: skill
scope: consumer
---

# Verify a UI change in the running app

A build that passes says nothing about what the user sees. Serve the app, drive the real page in
a headless browser, and assert on the rendered DOM and computed styles.

## 1. Serve the app

It may already be running. Check before starting a second instance - the dev server prompts for
another port and hangs:

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:4200/
```

- `200` → it is up.
- anything else → start it in the background and poll the curl above until it answers (a cold
  build can take a minute):

  ```bash
  npx nx serve <app>
  ```

The port and any proxy config live in the app's `project.json` `serve` target. A view behind a
login needs a session: log in once through the form in the script, or seed the token storage the
app reads before `page.goto`.

## 2. Drive it with Playwright

Use the `playwright` package from the repo's `node_modules`. Write the script in a scratch
directory outside the repo and run it with `node`:

```js
import { createRequire } from 'node:module';

const require = createRequire(`${process.cwd()}/`);
const { chromium } = require('playwright');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

await page.goto('http://localhost:4200/players?search=mul', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.players-table', { state: 'attached' });

const state = await page.$eval('.players-table', (el) => {
  const cs = getComputedStyle(el);
  return { display: cs.display, color: cs.color, rows: el.querySelectorAll('tr').length };
});
console.log(JSON.stringify(state));

await page.screenshot({ path: '/tmp/players.png', fullPage: true });
await browser.close();
```

Then read the screenshot back and look at it.

- **`playwright` is CommonJS** - resolve it with `createRequire`; a named ESM import fails.
- **`waitUntil: 'domcontentloaded'`, never `networkidle`** - the dev server's live-reload socket
  and any polling query keep the network busy forever.
- **`waitForSelector` waits for visible by default.** Pass `{ state: 'attached' }` for anything
  correctly hidden (`opacity: 0`, collapsed, `inert`).
- **Overlays render at the end of `<body>`,** not inside the view that opened them. Query them from
  `page`, not from the view's element.
- After a click that starts a transition, wait out its duration before reading final styles.

## 3. Pointer and cursor state

`getComputedStyle(el).cursor` reports what the stylesheet says, not what the pointer gets - an
overlay, a backdrop or `pointer-events: none` in between changes the answer. Ask the page which
element is under the point instead:

```js
const hit = await page.evaluate(
  ([x, y]) => {
    const el = document.elementFromPoint(x, y);
    return el && { tag: el.tagName, class: el.className, cursor: getComputedStyle(el).cursor };
  },
  [640, 300],
);
```

`elementFromPoint` returns `null` outside the viewport, so use a viewport tall enough for the
point, or scroll the target into view first. Hover with `page.mouse.move(x, y)` before reading
`:hover` styles.

## 4. Prove a fix with a test that bites

A screenshot shows the fix once; a test keeps it. For a bug fix, write the spec (a unit spec for
logic, or a Playwright e2e spec where the app has one), then:

1. run it against the fix - it passes;
2. revert the fix (stash it, or comment the one line out) and run it again - it **must fail**;
3. restore the fix.

A test that passes both ways asserts on the wrong thing. Fix the test before you call the change
done.

## 5. Report

Say what you drove (URL, clicks, viewport) and what you observed, with the numbers you read. Keep
the script and screenshots in the scratch directory, not the repo.
