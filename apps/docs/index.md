---
layout: home

hero:
  name: 'Ethlete SDK'
  text: 'Angular utilities for building fast, typesafe apps'
  tagline: Query management, auth, CDK components and more.
  actions:
    - theme: brand
      text: Get Started
      link: /components/
    - theme: alt
      text: View on GitHub
      link: https://github.com/ethlete-io/ethdk

features:
  - title: '@ethlete/components'
    details: The active Angular UI library - overlays, menus, buttons, forms and more, built signal-first.
    link: /components/
  - title: '@ethlete/bracket'
    details: Framework-free bracket graph and prediction resolution, usable without Angular.
    link: /bracket/
  - title: '@ethlete/query'
    details: Declarative, typesafe HTTP query management with caching, polling, auth and GQL support.
    link: /query/
  - title: '@ethlete/query-devtools'
    details: The in-app inspector for the query system - queries, auth, cache, faults and mocks. Loads on demand, ships with nothing.
    link: /query-devtools/
  - title: '@ethlete/types'
    details: Shared TypeScript types for the Ethlete API - mostly generated, zero runtime code.
    link: /types/
  - title: '@ethlete/eslint-plugin'
    details: Custom ESLint rules and shareable flat configs enforcing the Ethlete styleguide.
    link: /eslint/
  - title: '@ethlete/core'
    details: Framework primitives - element signals, theming, animations, the overlay runtime and utilities.
    link: /core/
  - title: '@ethlete/cdk'
    details: The previous UI library - tables, carousels, selects and more. In maintenance mode, superseded by components.
    link: /cdk/
  - title: '@ethlete/contentful'
    details: Contentful rendering helpers for Angular.
    link: /contentful/
  - title: '@ethlete/cli'
    details: Release tooling for Changesets-based repos - the `et release` command.
    link: /cli/
  - title: '@ethlete/agent-rules'
    details: The Ethlete coding guidance compiled into Claude Code, Codex, Cursor and Copilot formats.
    link: /agent-rules/
---

## Using these docs with LLMs

This site follows the [llms.txt convention](https://llmstxt.org). Point your tool at:

- [`/llms.txt`](/llms.txt) - an index of every page with links to raw markdown versions
- [`/llms-full.txt`](/llms-full.txt) - the entire documentation in a single file
- Append `.md` to any page URL (e.g. `/components/button.md`) to get that page as raw markdown
