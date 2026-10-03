# Move the runtime color theming to Tailwind 4

`provideColorThemes()` injects the color theme CSS at runtime and pairs with a Tailwind 3 config built from
`createTailwindColorThemes()`. It is deprecated: `@ethlete/components` expects
`provideColorThemesWithTailwind4()`, the CSS the Tailwind 4 generators emit, and a set of surface themes.

The theme data carries over unchanged. A codemod does the mechanical part; the rest is setup that depends
on the app.

## What to change

1. Run the codemod:

   ```bash
   nx g @ethlete/core:migrate-legacy-color-themes
   ```

   It rewrites every `provideColorThemes(X)` imported from `@ethlete/core` into
   `provideColorThemesWithTailwind4(X)`, fixes the import, and writes
   `legacy-color-themes-migration-tasks.md` at the workspace root. Pass `--projects` or `--include` to
   migrate one app at a time.

2. Work through `legacy-color-themes-migration-tasks.md`. It lists, per call site, the
   `tailwind-4-color-theme` generator run that replaces the runtime styles, every Tailwind 3 helper left
   in a config, and - when no app provides any yet - the surface themes to build.

3. Move the Tailwind 3 config to Tailwind 4, run both generators, and import the generated `.css` in each
   app's global stylesheet. Keep the prefix the Tailwind 3 config used, so the utility names stay.

4. Derive the first surface themes from the app's existing page background, text, muted text and border
   colors. Ask the user before inventing colors the app does not have.

5. Search the app's own CSS for `--et-color-alt-`. Those variables are not emitted any more; move the
   region into its own `etProvideColor` scope and read `--et-color-primary` there.

6. Build the app and compare a page against the old one: the colors must match.

The guide is at <https://ethlete-sdk-docs.web.app/core/theming#migrating-from-runtime-theming>.
