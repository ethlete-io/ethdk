---
'@ethlete/cli': patch
'@ethlete/design': patch
---

The design server loads vite and @tailwindcss/postcss from the served project first, and falls back to its own copy when the project has none.
