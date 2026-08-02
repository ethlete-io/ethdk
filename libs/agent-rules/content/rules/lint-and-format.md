---
name: lint-and-format
description: Run lint with --fix before fixing anything by hand, and format every edited file.
kind: rule
scope: both
vars: [lintCommand, lintFixCommand, formatCommand]
---

## Linting & formatting

Run lint with `--fix` — most styleguide rules in `@ethlete/eslint-plugin` ship auto-fixers,
so let them do the work before correcting anything by hand:

```bash
{%lintFixCommand%}   # auto-fixes first (case, ordering, $ suffix, metadata, …)
{%lintCommand%}      # then re-run to see what needs a manual fix
```

For the judgment calls lint cannot enforce — signals vs RxJS, templates, lifecycle and DI
patterns — see {%skill:styleguide%}.

After editing any file, format it before wrapping up:

```bash
{%formatCommand%}
```
