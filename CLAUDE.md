# ethlete-sdk

Nx monorepo of publishable `@ethlete/*` libraries under `libs/`.

## Libraries

All under `libs/<name>`, published as `@ethlete/<name>`:

| Lib             | What it is                                                                                                                                 | Depends on (`@ethlete/*`) |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------- |
| `types`         | Shared TS types (API, pagination, violations). Framework-agnostic base.                                                                    | —                         |
| `core`          | Framework primitives: directives, signals utils, overlay runtime, animations, theming, scrolling, drag/resize. Angular but component-less. | `types`                   |
| `query`         | Data fetching / query client: http, gql, ws, auth, query-form.                                                                             | `core`, `types`           |
| `components`    | **Active** Angular UI library: overlay, menu, button, forms, grid, tabs, tooltip, etc.                                                     | `core`                    |
| `cdk`           | **Maintenance mode** — older UI toolkit. Predecessor of `components`.                                                                      | `core`, `query`, `types`  |
| `contentful`    | Contentful integration (rich-text components, gql, types).                                                                                 | `cdk`, `core`, `query`    |
| `cli`           | CLI tooling (release helpers).                                                                                                             | —                         |
| `eslint-plugin` | Custom ESLint rules + shareable flat configs for the styleguide.                                                                           | —                         |

Rough layering: `types` → `core` → (`query`, `components`) ; `cdk` → `contentful`.

### UI work: components vs cdk

- **`components` is the active UI library.** All new UI features go here.
- **`cdk` is in maintenance mode.** Bug fixes are fine, but do **not** add new
  features there. When a fix also applies to `components`, apply it there too; the
  equivalent code almost always lives there (often more evolved).
- Many things exist in both libs with near-identical paths (e.g.
  `libs/cdk/.../overlay` vs `libs/components/src/lib/overlay`). Confirm which lib
  you're in before editing — new feature work goes in `libs/components`.

### Styling

Component styles are plain CSS (global `et-`-prefixed classes,
`ViewEncapsulation.None`) — see the `.css` files next to each component. **Do not
use Tailwind in component source.** Tailwind utility classes are allowed **only in
story files** (`*.stories.ts` and `stories/`), for demo layout.

All colors in component CSS must come from the **surface theming** and **color
theming** token systems (`--et-surface-*-solid`, `--et-theme-color-*`) — never
hardcode colors. Read the **`theming`** skill (`.claude/skills/theming/`) before
touching any color, background, border, or interaction-state styling.

Theme **names** (`brand`, `danger`, `dark-elevated`, …) are registered by the
consuming app — the SDK defines none. Don't hardcode name unions in types, docs,
or examples; semantic colors resolve via theme `type` (e.g. `injectErrorTheme()`).

## Releasing

Every change to a published package needs a changeset. Use the **`changeset`**
skill (`.claude/skills/changeset/`) — write the file directly; don't run the
interactive `npx changeset` CLI.

## Documentation

Written docs live in the VitePress site at `apps/docs` (deployed per branch),
with one guide per component domain under `apps/docs/components/`. Any change to
a public API, behavior, or default in `libs/components` must update the matching
guide (or add a new page for a new domain) — treat it like the changeset: part
of the change, not a follow-up. Use the **`docs`** skill
(`.claude/skills/docs/`) for structure, story embeds (`<StoryEmbed>`), and
verification. Docs embeds reference Storybook story ids — when renaming a story
title, grep `apps/docs` for the old id.

## Linting & style

Run lint with `--fix` — most styleguide rules have auto-fixers, so let them do the
work before fixing anything by hand:

```bash
npx nx lint <project> --fix
```

The rules live in `@ethlete/eslint-plugin`. For the judgment calls lint can't
enforce (signals vs RxJS, templates, lifecycle/DI patterns, etc.), see the
**`styleguide`** skill.

After editing any file, format it with Prettier before wrapping up (config is
`.prettierrc.js`):

```bash
npx prettier --write <files>
```

## Verifying UI changes

Storybook is the ground truth and usually runs on `:4400`. Use the
**`verify-in-storybook`** skill to drive real stories headlessly before
considering a component change done.
