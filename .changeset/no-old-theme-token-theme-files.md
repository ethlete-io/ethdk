---
'@ethlete/eslint-plugin': minor
---

`ethlete/no-old-theme-token` gets a `themeFiles` option: it reads the theme names from the generated theme CSS and flags old Tailwind tone and surface classes (`bg-et-brand`, `text-et-danger-ink`, `text-et-surface-dark`); without it, a possible old class is reported as unknown theme names.
