---
'@ethlete/eslint-plugin': minor
---

Add two component I/O naming rules:

- `no-native-html-input-name` (error) — flags an `input()`/`model()` named after a global HTML attribute (`title`, `id`, `hidden`, `role`, `tabindex`, …), which collides with the attribute the host element carries natively.
- `prefer-present-tense-output` (warn) — nudges `output()` names toward the present tense like native DOM events (`playerSelect`, not `playerSelected`).

The `on`-prefix case is already covered by `@angular-eslint/no-output-on-prefix`, so no rule is added for it.
