# Migrating from the v4 line

An app on the v4 line - `@ethlete/cdk` 4, `@ethlete/core` 4, `@ethlete/query` 5, `@ethlete/contentful` 3 -
moves to the current libraries in a fixed order. Each library's page covers its own step; this page is
the order, the commands and what each step leaves behind.

For scale: one real app with cdk in 680 files, 375 `*etQuery` template sites, 273 files of reactive
forms and a 3000-line stylesheet over the cdk classes. The codemods take an afternoon. The forms and
the styles take the time.

## 1. The dependency floor

Every current lib peers on these, so they move first, each in its own commit:

| Package                     | Floor               | How                                                          |
| --------------------------- | ------------------- | ------------------------------------------------------------ |
| Angular (`@angular/*`)      | `^22.1.0`           | `nx migrate` / `ng update`, one major at a time              |
| TypeScript                  | `^6.0.0`            | comes with the Angular 22 migration                          |
| Nx (only for the codemods)  | `^23.0.0`           | `nx migrate latest`                                          |
| RxJS                        | `^7.8.0`            |                                                              |
| Tailwind                    | 4                   | the theming setup is Tailwind 4 only, see [step 5](#theming) |
| `date-fns` / `@date-fns/tz` | `^4.0.0` / `^1.2.0` | only for the date and time controls of `@ethlete/components` |

The SDK publishes ranges, so a later Angular 22 patch or minor needs no SDK release.

## 2. Move every package to the `next` line

`et update` follows the dist tag the installed version belongs to, so a v4-line repo stays on `latest`
and says `a newer major is on "next"` for each package. Move them together:

```bash
yarn et update --tag next
```

It runs the **required** migrations of every version it crosses, oldest first and in the lib layering
inside one version:

| Package               | First required migration | What it does                                                                                                                                          |
| --------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@ethlete/core`       | `to-v5`                  | viewport and router helpers to signals, theme → color renames. [Core](/core/#also-in-the-package)                                                     |
| `@ethlete/cdk`        | `to-v5`                  | dialog/bottom sheet → overlay, `*etLet` removal, theming move to core. [CDK](/cdk/#migrating-from-v4)                                                 |
| `@ethlete/query`      | `prep-for-query-v3`      | renames the legacy symbols the current client collides with. [Query](/query/migrating-from-v2)                                                        |
| `@ethlete/contentful` | `to-contentful-v5`       | image input rename, `useTailwindClasses` removal, adds `@ethlete/components`; tasks in `contentful-v5-migration-tasks.md`. [Contentful](/contentful/) |

The later required migrations of each package run in the same pass: core `provider-shape`,
`surface-interaction-swatch` and the tasks `seo-directive-removed` and `surface-theme-regenerate`; query
`query-client-features`, `query-opt-in-features` and the tasks `search-query-field-string` and
`query-field-default-types`; contentful `contentful-default-components`; and the required migrations of
`@ethlete/components` and `@ethlete/eslint-plugin` once they are installed.

`@ethlete/types` 2 no longer exports `JsonLD`, and no migration rewrites it: import it from
`@ethlete/core` instead.

What a codemod cannot finish lands in `.ethlete/update/tasks.md` (and `tasks.json` for an agent). Work
that list until it is empty and the app builds - it is still the cdk app, on the new versions.

`yarn et migrations` then lists the recommended and optional ones. Run them in this order, each in its own commit.

## 3. Query: the current client

```bash
yarn nx g @ethlete/query:migrate-to-query-v3
yarn nx g @ethlete/query:report-legacy-query-apis
```

The first converts the clients and wraps every creator in a `legacy*` interop creator, so the app keeps
working; its leftovers are in `query-v3-migration-tasks.md`. The report lists every legacy API that
still needs a hand edit, `*etQuery` templates included. Migrate screen by screen with
[Migrating from the legacy client](/query/migrating-from-v2).

## 4. CDK → components

Install `@ethlete/components` first, then:

```bash
yarn nx g @ethlete/cdk:migrate-from-cdk
```

It rewrites every mechanical row of the [migration map](/cdk/migration) and writes the rest into
`migrate-from-cdk-tasks.md`, including the [app stylesheet selectors](/cdk/migration#your-cdk-styles)
that no components class matches. [Run the codemod](/cdk/migration#run-the-codemod) has the scoping
flags.

The components form controls bind through signal forms (`[formField]`) only. A screen whose form is a
reactive `FormGroup` keeps its cdk controls until that form moves to `form(model, schema)` - see
[Forms](/components/forms). cdk and components controls can live side by side in one app, so this is a
screen-by-screen job.

## 5. Theming {#theming}

The runtime theming (`provideColorThemes`, `createTailwindColorThemes`) is deprecated. The components
read surface and colour tokens from generated Tailwind 4 CSS - see
[Migrating from runtime theming](/core/theming#migrating-from-runtime-theming).

```bash
yarn et migrations run core:legacy-color-themes
```

It rewrites `provideColorThemes` into `provideColorThemesWithTailwind4` and writes the generator runs and
the surface themes to add into `legacy-color-themes-migration-tasks.md`.

## You are done when

- [ ] `@ethlete/cdk` is gone from every `package.json`, and no file imports it.
- [ ] `.ethlete/update/tasks.md`, `query-v3-migration-tasks.md`, `contentful-v5-migration-tasks.md`,
      `contentful-default-components-migration-tasks.md`, `migrate-from-cdk-tasks.md` and
      `legacy-color-themes-migration-tasks.md` are empty or deleted.
- [ ] `report-legacy-query-apis` reports nothing, or only what you decided to keep on the interop.
- [ ] No component uses a reactive `FormControl` with an `et-*` control.
- [ ] `provideColorThemes` is gone, and the app's own CSS reads only the generated `--et-*` tokens.
- [ ] Type check, lint and tests pass in every project.
