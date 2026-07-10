---
name: styleguide
description: Entry point for the Ethlete coding styleguide. Read when writing or reviewing TypeScript/Angular code in this repo. The mechanical rules are enforced by `@ethlete/eslint-plugin` (run lint with `--fix`); this skill covers the cross-cutting judgment calls (accessibility modifiers, `@internal`, naming intent, file/folder structure) and points to the focused `rxjs-signals` and `angular-patterns` skills.
---

# Styleguide — the parts lint can't check

Most of the styleguide is enforced automatically by **`@ethlete/eslint-plugin`**.
Don't hand-check or hand-fix those — **run lint with `--fix` first**; many rules
ship auto-fixers, so most violations are corrected for you:

```bash
npx nx lint <project> --fix      # auto-fixes first (case, ordering, $ suffix, metadata, …)
npx nx lint <project>            # then re-run to see what needs a manual fix
```

Full prose reference (incl. the rule→lint-rule table): `docs/STYLEGUIDE.md`.

## Focused skills

- **`rxjs-signals`** — synchronous state vs async, subscriptions, effects.
- **`angular-patterns`** — components, directives, services, pipes, templates,
  lifecycle.
- **`component-architecture`** — the three-tier model for building library
  components in `libs/components`.

The rest of this skill is the cross-cutting judgment that doesn't belong to one
of those.

## Accessibility & visibility

Lint auto-fixes injected providers to `private` and flags template/host-visible
members, but the *intent* is yours:

- Injected provider → `private` by default; `protected` **only** when referenced
  from the HTML template or a `host:` binding; **drop the modifier entirely** if
  keeping it `private` would force a member alias (a property whose sole purpose
  is re-exposing a nested member — expose the injected symbol directly instead).
- Never add a member that only **aliases** another member's nested property
  (`foo = this.thing.foo`) — widen the source member's visibility and use it.
- For a member that must stay technically public purely for cross-class/DI use
  (e.g. a self-registration method called by a sub-directive), keep it `public`
  and tag `/** @internal */` so build tooling strips it from the published
  `.d.ts`. Never put `@internal` on `private`/`protected` members.

## Naming with intent

- Name things after **what they do**, not the mechanism: an `onChange` that posts
  a form → `sendFormValueToApi`. (Lint catches `on`-prefixed *outputs*; plain
  functions/methods are on you.)
- More than two params → a single **object parameter** with a named `type`.
- Descriptive generics (`TValue`, `TResult`) and descriptive const/var names.

## File & folder structure (app code)

For components in **`libs/components`**, follow the `component-architecture` skill
instead. For application code:

- Mirror routes in the folder tree; routing components end in `-view`.
- Reusable pieces → `components/`; a component's private children → `partials/`
  (used only by that parent); Storybook helpers → `storybook/` (never exported
  from the component's public surface); generic dumb components → `uikit/`;
  app-shell pieces → `shell/`.
- Each exportable folder has an `index.ts` barrel — but **import from the source
  file, not the barrel** (barrel imports are lint-banned; they break lazy loading).
- Don't import from a parent directory in a subdirectory (circular-dep risk).

## Changesets

Every published change needs one — see the **`changeset`** skill.
