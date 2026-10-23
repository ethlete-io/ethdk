---
name: nx-layout
description: Nx workspace layout - thin apps, feature code in libs grouped by kind, path-mirroring aliases, scope tags.
kind: rule
scope: consumer
requires: ['nx']
---

## Nx workspace layout

Apps are thin shells. All feature code lives in libs, grouped by kind, not by Nx type:

```text
apps/<app>/src/app/        app.component.ts, app.config.ts, app.routes.ts only
libs/
  domain/<app>/            one lib per app
    src/lib/<feature>/     views, components, services, <feature>.routes.ts
    src/lib/shared/        code shared by the app's features (optional)
  queries/                 query clients and creators, one folder per backend
  types/                   API models and shared types
  uikit/                   app-agnostic presentational components
  theme/                   surface and colour themes
  env/                     environment.ts, environment.production.ts
  assets/                  fonts, icons, images
```

- Each feature folder exports its own `<FEATURE>_ROUTES`, re-exported from the lib's
  `src/index.ts`. `app.routes.ts` only lazy-loads them:
  `loadChildren: () => import('@acme/domain/admin').then((m) => m.USERS_ROUTES)`.
- Split a feature into its own lib (`libs/domain/<app>/<feature>`) only for a concrete
  reason, such as size or build time, and name that reason to the user.
  Never put features, queries, shared UI or theme in the app project.
- Do not add Nx `feature/ui/data-access/util` folders or `type:*` tags.
- Every lib has `src/index.ts` and explicit `build` (`@nx/angular:ng-packagr-lite`), `lint`
  and `test` targets in `project.json`. Keep `plugins: []` in `nx.json`.
- Alias = path with slashes: `@acme/domain/admin`, `@acme/queries`, `@acme/types`,
  `@acme/uikit`, `@acme/env`. Project name = path with dashes (`domain-admin`).
  Component `prefix` = the repo abbreviation.
- Tag every project with one `scope:*`: `scope:<app>` for an app and its domain libs,
  `scope:core` for env and types, plus `scope:queries`, `scope:uikit`, `scope:theme`.
  `@nx/enforce-module-boundaries` with `enforceBuildableLibDependency: true` lets
  `scope:<app>` depend on itself and the shared scopes, never on another app.
- A backend in the same workspace is an app in `apps/` with its libs in
  `libs/domain/<name>-api`. Ban `@angular/*` in backend scopes and `@nestjs/*` in frontend
  scopes with `bannedExternalImports`.
- Environment config lives only in `libs/env`, never hardcoded in a query client.

This is the layout for new workspaces and new code. Do not restructure the folders, projects
and tags of an existing workspace that deviates from it unless the user asks. This covers the
workspace layout only: every other rule still applies to the code you touch.
