---
name: verify-in-storybook
description: Visually/behaviorally verify a component change by driving its Storybook story headlessly with Playwright. Use whenever you change a UI component and need to confirm the rendered DOM, computed styles, animations, or interactions actually work - not just that it compiles.
kind: skill
scope: consumer
vars: [storybookUrl, storybookStartCommand]
---

# Verify a component change in Storybook (headless Playwright)

Storybook is the ground truth for component behaviour. Drive the real story in a
headless browser and assert on the rendered DOM / computed styles, rather than
trusting a build alone.

## 1. Make sure Storybook is running

It is usually already up. Check first - **do not blindly start a second
instance**, it will hit an interactive port prompt and hang:

```bash
curl -s -o /dev/null -w "%{http_code}" {%storybookUrl%}/
```

- `200` → it's up, proceed.
- anything else → start it in the background and wait for the port:
  ```bash
  {%storybookStartCommand%}
  ```
  Run it in the background and poll the curl above until it returns `200`
  (a cold start can take 30–60s).

## 2. Find the story ID

Story IDs are derived from the story `title` + export name, e.g.
`Components/Tabs/Inline` → `components-tabs-inline--default`. List them from the
index:

```bash
curl -s {%storybookUrl%}/index.json \
  | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const j=JSON.parse(d);Object.values(j.entries).filter(s=>/YOURFILTER/i.test(s.title)).forEach(s=>console.log(s.id,'::',s.title,'::',s.name))})"
```

## 3. Open the story headlessly

Render a single story in isolation via the **iframe URL** (no manager chrome):

```
{%storybookUrl%}/iframe.html?id=<story-id>&viewMode=story
```

## 4. Drive it with Playwright

Playwright must be in the repo's devDependencies (`@playwright/test` /
`playwright`). Write the script in a scratch directory, resolve Playwright from
the repo's `node_modules`, and run it - {%resource:verify-template.mjs%} is a
copy-paste starting point.

Gotchas that will waste your time if you forget them:

- **`playwright` is CommonJS.** In an `.mjs`, resolve it with `createRequire`
  (as the template does) - a named `import { chromium } from 'playwright'` fails.
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
etc.) and whether it matched the expected behaviour. Keep the throwaway script in
the scratch directory, not the repo.
