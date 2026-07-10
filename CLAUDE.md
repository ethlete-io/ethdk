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

## Releasing

Every change to a published package needs a changeset. Use the **`changeset`**
skill (`.claude/skills/changeset/`) — write the file directly; don't run the
interactive `npx changeset` CLI.

## Linting & style

Run lint with `--fix` — most styleguide rules have auto-fixers, so let them do the
work before fixing anything by hand:

```bash
npx nx lint <project> --fix
```

The rules live in `@ethlete/eslint-plugin`. For the judgment calls lint can't
enforce (signals vs RxJS, templates, lifecycle/DI patterns, etc.), see the
**`styleguide`** skill.

## Verifying UI changes

Storybook is the ground truth and usually runs on `:4400`. Use the
**`verify-in-storybook`** skill to drive real stories headlessly before
considering a component change done.
