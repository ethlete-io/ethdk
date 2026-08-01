---
'@ethlete/components': minor
---

Move all component styles into the `components` CSS cascade layer (`@layer components`).

Component CSS was previously injected unlayered, which meant it beat Tailwind
utility classes (in `@layer utilities`) regardless of specificity - forcing
consumers to reach for `!important` (e.g. `flex!`) to override layout, spacing or
sizing on components. Because layer precedence is resolved before specificity,
`:where()` could not fix this.

Now that component rules live in `@layer components` (which Tailwind v4 orders
before `utilities`), a plain utility class overrides component styles without
`!important`. This is a behavior change: any consumer rule that is unlayered or
in a later layer now wins over component styles by default. Apps using the
default Tailwind v4 layer order (`theme, base, components, utilities`) get the
fix automatically; apps that customize layer order should ensure `components`
sorts before their utilities.
