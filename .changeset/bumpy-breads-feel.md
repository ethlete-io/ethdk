---
'@ethlete/core': minor
---

Add generator to create a Tailwind CSS v4 theme based on predefined themes.
Run it via `nx g @ethlete/core:tailwind-4-theme --themesPath=<path-to-themes> --outputPath=<output-css-file-path>`.
You should also replace all usages of `provideColorThemes(themes)` with `provideColorThemesWithTailwind4(themes)` after.
Don't forget to add the generated css file to you main css entry point.