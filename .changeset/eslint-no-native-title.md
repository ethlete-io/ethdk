---
'@ethlete/eslint-plugin': minor
---

Add `ethlete/no-native-title`, off in `recommendedTemplate` until projects opt in: it reports a native `title` attribute (`title="…"`, `[title]`, `[attr.title]`) on HTML elements, because the SDK tooltip replaces it. Components with a dash in their name keep their own `title` input.
