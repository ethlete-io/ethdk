# bracket, match, standings (components) scan - open findings

Scan of `libs/components/src/lib/bracket/`, `libs/components/src/lib/match/`, `libs/components/src/lib/standings/` from 2026-09-28. 0 High, 0 Medium, 0 Low, 2 Spec (verified: 9 confirmed, 3 re-rated, 0 refuted, 1 unverified; 2 Medium and 6 Low fixed 2026-09-29 in 7e69a8971 and f2e9af7d0). Skipped: specs, stories, `testing/` drivers, most CSS (checked for `@layer`, colours and Tailwind only). The framework-free model in `libs/bracket` is out of scope.

## Spec gaps

- Spec: no reduced-motion test for `match/match-score.component.ts`, and no card test that swaps `match` for a different id. S
- Spec: no `standings-pick` test that changes `participants` after a move. S
