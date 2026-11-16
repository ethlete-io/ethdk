---
status: accepted
built: ae5d82435
decided: 2026-11-16
source: doc-agent session 2026-11-16, fifa report L-8 (gg hero videos need controls=0)
---

# The YouTube player takes playerVars merged over the SDK defaults

The SDK YouTube player hardcodes its player vars (`youtube-player.directive.ts`); an app cannot change any of them, and
the `YtPlayerVars` type is unused. gg's hero videos need `controls=0`. Offered (a) a `playerVars` input on the player,
the slot and the params directive, merged over the defaults, (b) single inputs such as `controls`, (c) no SDK change.
The human: "Q1ok" (option a, the recommendation).

`@ethlete/components` gets a `playerVars` input typed `YtPlayerVars` on the player, the slot and the params directive.
The given keys win; every other key keeps the SDK default. Without the input nothing changes. Docs page and changeset
are part of the change.
