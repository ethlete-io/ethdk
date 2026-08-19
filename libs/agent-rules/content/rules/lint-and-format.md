---
name: lint-and-format
description: Run lint with --fix before fixing anything by hand, and format every edited source file Prettier supports.
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

For judgment calls lint cannot enforce, load the repository's focused guidance for the
code you are changing.

Format every edited Prettier-supported source file before wrapping up. Do not send binary,
generated, or unsupported files to this command:

```bash
{%formatCommand%}
```
