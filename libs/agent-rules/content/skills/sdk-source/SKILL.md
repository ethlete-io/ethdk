---
name: sdk-source
description: How to read the @ethlete SDK's own source from a local ethlete-sdk checkout when the docs and the installed types are not enough. Read when you need an implementation detail, the exact behaviour behind a bug, or an API the docs do not cover - and never edit that checkout as part of work in this repo.
kind: skill
scope: consumer
vars: [docsBaseUrl]
---

# Reading the @ethlete SDK source

The SDK is developed in a separate repository (`ethlete-sdk`). Most questions are
answered faster and more reliably by the documentation - read {%skill:sdk-docs%}
first. Reach for the source when the docs genuinely cannot answer the question:

- a behaviour looks like an SDK bug and you need to see what the code actually does
- you need an implementation detail the guides omit (event order, internal defaults,
  which host directive writes which attribute)
- the installed version is ahead of - or behind - the published docs and you have to
  confirm what the code in _this_ version does
- you are about to report or fix something in the SDK itself

## 1. Resolve the checkout

The path is per machine, so it lives in the gitignored `ethlete-agents.config.local.json`
at the repo root:

```json
{
  "sdkSourcePath": "/absolute/path/to/ethlete-sdk"
}
```

Read that file before searching anywhere. A relative path is resolved from the repo root.

If the file or the key is missing, **do not guess a path** and do not clone the
repository. Fall back to the installed package - `node_modules/@ethlete/<lib>/types/`
holds the full `.d.ts` surface of exactly the version this repo runs - and to
{%docsBaseUrl%}. Then tell the user a local checkout would help, and offer the snippet
above (the file is gitignored, so adding it changes nothing for anyone else).

## 2. Check the checkout matches what is installed

A checkout sits on whatever branch the developer left it on, so it can be months of
work ahead of the installed package - or behind it. Compare before you trust it:

```bash
grep '"@ethlete/' package.json                          # what this repo runs
grep -m1 '"version"' <sdkSourcePath>/libs/<lib>/package.json   # what the checkout is at
git -C <sdkSourcePath> status -sb                       # branch, and whether it is dirty
```

Rules when they differ:

- **The installed package wins** for anything about how this repo behaves today. The
  `.d.ts` in `node_modules` is the truth about the API you are calling.
- Source that is ahead describes an **unreleased** API. Never write consumer code
  against it, and never assume it is available - say what release it needs.
- A dirty checkout may contain someone's work in progress. Say so rather than quoting
  it as SDK behaviour.

## 3. Where things live

Paths are relative to the checkout root:

| Path                                | What is in it                                                               |
| ----------------------------------- | --------------------------------------------------------------------------- |
| `libs/components/src/lib/<domain>/` | The active UI library, one folder per domain (`button`, `menu`, `table`, …) |
| `libs/core/src/lib/`                | Framework primitives: directives, signal utils, overlay runtime, theming    |
| `libs/query/src/lib/`               | Data fetching: `http`, `gql`, `ws`, auth, query-form                        |
| `libs/types/src/lib/`               | Shared types                                                                |
| `libs/cdk/`                         | The predecessor UI toolkit, maintenance mode - only for code still on it    |
| `libs/eslint-plugin/src/`           | The lint rules, including the message text explaining each one              |
| `apps/docs/`                        | The markdown behind {%docsBaseUrl%}                                         |
| `apps/playground/`                  | The Storybook app - stories also live next to each component                |

Inside a component domain: `<name>.component.ts` with its `.css` next to it,
`<name>.imports.ts` (the imports array to spread into a consumer component),
`headless/` for the unstyled directives, `stories/` for the Storybook stories, and
`index.ts` as the barrel. The lib's public surface is `libs/<lib>/src/index.ts` -
anything not re-exported from there is internal, whatever it looks like.

## 4. Search it, don't read it whole

```bash
rg -n "etButton" <sdkSourcePath>/libs/components/src --glob '!*.spec.ts'   # a selector
rg -n "export const OVERLAY" <sdkSourcePath>/libs/core/src                 # an export
rg -n "menu" <sdkSourcePath>/apps/docs/components                          # the guide source
```

Specs are the cheapest description of intended behaviour - `<name>.component.spec.ts`
next to a component usually answers "is this supposed to happen?" faster than the
implementation does.

## 5. The checkout is read-only from here

It is a different repository with its own branch, lint, docs and changeset workflow.
Never edit it while working on a task in this repo, and never copy its internals into
consumer code - a private helper is not a supported API and disappears without a major
version (the same goes for anything under a `subtle` namespace).

When the fix belongs in the SDK, say so and describe it precisely: file, symbol, and
the behaviour it should have. If the user wants that fix verified against this app
before it ships, that is {%skill:sdk-local-build%}.

## Related

- Docs and Storybook, which come first: {%skill:sdk-docs%}
- Testing an unreleased SDK build here: {%skill:sdk-local-build%}
