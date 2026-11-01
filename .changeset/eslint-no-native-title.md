---
'@ethlete/eslint-plugin': minor
---

Add `ethlete/no-native-title`, enabled in `recommendedTemplate`: it reports a native `title` attribute (`title="…"`, `[title]`, `[attr.title]`) on HTML elements, because the SDK tooltip replaces it. Components with a dash in their name keep their own `title` input.
