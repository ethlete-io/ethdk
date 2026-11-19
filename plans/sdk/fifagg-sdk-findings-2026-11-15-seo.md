# FIFA.GG: SDK findings from the SEO migration (7.26)

Consumer: `fifagg-frontend`, branch `refactor/seo-core-f`, MR !2054. Installed: `@ethlete/core` 5.0.0-next.74.
Reported by the fifa session on 2026-11-15. Not yet checked against `next`.

## 1. ~~Title part has no public "on top" priority~~ Built fdf3ef0cf (ADR 0378)

Suspect: an overlay (match details) adds its title part with `useAsStart: true`; a page whose title binds later
(route change, or late data under the overlay) replaces it. `libs/core/src/lib/seo/title-binding.ts` orders parts by
a claim counter (`claimPriority`, `addPart(id, part, priority)`), so a later binding wins.

Workaround in fifa: a re-assert effect in
`libs/domain/shared/src/lib/match-overlay/components/match-overlay-host/match-overlay-host.component.ts:664`
(removePart + addPart when `titleStore.title()` no longer ends with the overlay title).

Wish: a priority or "on top" flag for a part, or documented ordering rules.

## 2. ~~A head store write inside an effect that reads the store loops forever~~ Built b23a3ab16

Suspect: a write into a head store (title, meta, link, JSON-LD) from an `effect()` reads the store's own state
signal tracked, so the effect marks itself dirty: endless synchronize loop, main thread freezes.
Repro: `effect(() => { metaStore.set(...) })` where `set` reads its own state signal tracked.

Fifa fix: write in `untracked` (fifa commit 85f583685e) and bind computeds with `applyHeadTitleBinding`,
`applyCanonicalBinding`, `applyStructuredDataBinding`.

Wish: the store write methods wrap their reads in `untracked`, or the docs warn. Fix at the cause (the write
methods), with a core scenario test (`libs/core/src/scenarios`).
