# Regenerate the surface theme after the swatch change

`SurfaceTheme['interactionColor']` is a swatch now: `{ color, onColor, inkColor }` instead of a single
colour. `nx g @ethlete/core:migrate-surface-interaction-swatch` rewrites the theme definitions, but the
generated stylesheet still holds the CSS variables of the old shape.

Regenerate it with the same command that created it, in each app that has a surface theme:

```bash
nx g @ethlete/core:tailwind-4-surface-theme
```

The generator asks for the same answers as the first time. It overwrites the generated stylesheet, so
check the diff: a hand-written override inside the generated file is lost.

`onColor` and `inkColor` carry the two foreground colours an interaction surface needs. The codemod
fills them from the old single colour, which keeps the rendering identical but is rarely the design
intent. Read the swatch through with the designer once, then correct the values.

The theming guide is at <https://ethlete-sdk-docs.web.app/core/theming>.
