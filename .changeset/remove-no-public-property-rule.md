---
'@ethlete/eslint-plugin': major
---

Remove the `no-public-property` rule. It contradicted `template-member-accessibility`, which requires an explicit `public` modifier on surface members - the explicit-public style is the intended one. The rule was never part of the `recommended` config; if you enabled `ethlete/no-public-property` manually, drop it from your ESLint config.
