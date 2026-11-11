---
status: accepted
open: B492
decided: 2026-11-11
source: chat with the doc agent 2026-11-11 (late morning), from a fifagg report
---

# Tabs get tokens for type, baseline, hover and align

A consumer app rebuilt its tabs on `et-tab-group` and `et-nav-tabs` and found four gaps that only its own CSS could
close: no token for the trigger type (font-weight, text-transform, letter-spacing, line-height), no baseline size apart
from the underline size, no hover colour or edge for an inactive trigger, and no way to centre the bar. The human
answered "q1ok" to the recommendation: all four become public `--et-tab-*` tokens, each with a default that draws
today's look, so nothing changes where a token is not set. The alignment is a token, not an input, because an app
mostly sets it once for every tab bar.

In the same round the human answered "q2 ok kann ich aber erst machen wenn ich wieder am rechner bin" to the npm
deprecation message for `@ethlete/theming`: the human runs
`npm deprecate @ethlete/theming "Deprecated: use the theming of @ethlete/core (provideColorThemesWithTailwind4, ProvideColorDirective)."`
from the desk with their own npm login. No agent runs it.
