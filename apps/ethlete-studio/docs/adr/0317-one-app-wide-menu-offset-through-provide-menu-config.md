---
status: accepted
open: B534
decided: 2026-11-16
source: doc-agent session 2026-11-16, fifa report on the gg overlay migration (menu sits 4px from its trigger, the old gg menu 2px)
---

# One app-wide menu offset through provideMenuConfig

The SDK root menu sits 4px from its trigger; an app can change that only per trigger through the `[offset]` input, and
gg has many menu triggers. Offered (a) `provideMenuConfig({ offset })`, (b) a CSS token `--et-menu-offset` read at open,
(c) no SDK change, `[offset]` on every trigger. The human: "q1ok" (option a, the recommendation).

`@ethlete/components` gets `provideMenuConfig({ offset })`, following the `provideOverlayRouterConfig` pattern. It
replaces the default root menu offset for the app; an `[offset]` on a trigger still wins over it. Without the provider
the offset stays 4px. Docs page and changeset are part of the change.
