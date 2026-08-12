---
name: verify-in-storybook
description: Visually/behaviorally verify a component change by driving its Storybook story headlessly with Playwright. Use whenever you change a CDK/UI component and need to confirm the rendered DOM, computed styles, animations, or interactions actually work - not just that it compiles.
---

# Verify a component change in Storybook (headless Playwright)

Storybook is the ground truth for this repo's components. Drive the real story
in a headless browser and assert on the rendered DOM / computed styles, rather
than trusting a build alone.

## 1. Make sure Storybook is running on :4400

The user usually keeps it running. Check first - **do not blindly start a second
one**, it will hit an interactive port prompt and hang:

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:4400/
```

- `200` → it's up, proceed.
- anything else → start it in the background and wait for the port:
  ```bash
  npm run storybook   # = nx run storybook:storybook --no-open, serves on :4400
  ```
  Run it with `run_in_background: true` and poll the curl above until it returns `200`
  (first cold start can take 30–60s).

## 2. Find the story ID

Story IDs are derived from the story `title` + export name, e.g.
`CDK/Tabs/Inline` → `cdk-tabs-inline--default`. List them from the index:

```bash
curl -s http://localhost:4400/index.json \
  | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const j=JSON.parse(d);Object.values(j.entries).filter(s=>/YOURFILTER/i.test(s.title)).forEach(s=>console.log(s.id,'::',s.title,'::',s.name))})"
```

## 3. Open the story headlessly

Render a single story in isolation via the **iframe URL** (no manager chrome):

```
http://localhost:4400/iframe.html?id=<story-id>&viewMode=story
```

e.g. `http://localhost:4400/iframe.html?id=cdk-tabs-inline--default&viewMode=story`

## 4. Drive it with Playwright

Playwright is in the repo's devDependencies (`@playwright/test` / `playwright`;
**Puppeteer is NOT installed**). Write the script in the scratchpad, but resolve
Playwright from the repo's `node_modules` and run it - see `verify-template.mjs`
next to this file for a copy-paste starting point.

Gotchas that will waste your time if you forget them:

- **`playwright` is CommonJS.** In an `.mjs`: `import pw from '<abs>/node_modules/playwright/index.js'; const { chromium } = pw;` - a named `import { chromium }` fails.
- **Use `waitUntil: 'domcontentloaded'`**, never `networkidle` - Storybook's HMR
  websocket keeps the connection open so `networkidle` times out forever.
- **`waitForSelector` defaults to `state: 'visible'`.** Elements that are
  correctly hidden (`visibility:hidden`, `opacity:0`, collapsed height, `inert`)
  will never become "visible" and you'll get a misleading timeout. Use
  `{ state: 'attached' }` when you intend to inspect a hidden element.
- **Assert on the real signal.** Portal/`ng-content` text lands as text nodes, so
  `childElementCount` is 0 even when content is present - check `el.textContent`.
  Read computed styles with `getComputedStyle(el)` inside `page.$eval`.
- After a click that triggers a CSS transition, `waitForTimeout(transitionMs + buffer)`
  before reading final-state styles.

## 5. Report

State plainly what you drove and observed (collapsed→open→collapsed, tab switch,
etc.) and whether it matched the expected behavior. Keep the throwaway script in
the scratchpad, not the repo.

## Real mobile engines

Headless Chromium above is the default and covers most changes. For a change
that's specifically about touch behavior, mobile viewport/layout, or a
Safari/Chrome-mobile quirk, drive the story on an iOS Simulator or Android
emulator instead - see the **`verify-in-mobile-emulator`** skill (it detects
whether the tooling is installed and documents setup if not).
