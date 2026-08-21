# Components lib scan — noteworthy findings

Scan date: 2026-08-22 (in progress). Scope: all of `libs/components` — about 125k lines of
non-spec source under `src/lib` across 48 domains, plus the matching guides under
`apps/docs/components/`. Review agents read the source per batch; each agent verified its
claims against the code, and runtime-verified its top claims where practical.

Note: the working tree carried uncommitted changes in cascader, rich-text-editor, menu,
scrollbar and time-picker (branch `next`). The scan reviews the tree as it stands.

Model use: Opus 5 agents for the deep domain reviews, Sonnet 5 for the small domains,
Fable for batch design, synthesis and cross-checks.

## Batch status

| # | Scope | Lines | Model | Status |
| - | ----- | ----- | ----- | ------ |
| 1 | forms/rich-text-editor + multi-language-rich-text-editor | 11.4k | opus | pending |
| 2 | forms/date-time | 6.8k | opus | pending |
| 3 | forms/select + cascader | 8.4k | opus | pending |
| 4 | forms/form-field + input + textarea + masked-input + form + description | 6.8k | opus | pending |
| 5 | forms/selection-list + choice-field + checkbox + switch + rating + selection-card | 5.4k | opus | pending |
| 6 | forms/slider + dropzone + color-input | 7.6k | opus | pending |
| 7 | forms/phone-input + otp-input + tag-input + forms/testing | 3.9k | opus | pending |
| 8 | table | 10.7k | opus | pending |
| 9 | overlay | 7.5k | opus | pending |
| 10 | stream | 6.9k | opus | pending |
| 11 | bracket | 7.9k | opus | pending |
| 12 | scheduler | 5.4k | opus | pending |
| 13 | grid + masonry | 4.5k | opus | pending |
| 14 | menu + command-palette + toggletip + tooltip | 5.5k | opus | pending |
| 15 | carousel + scrollable + scrollbar | 5.2k | opus | pending |
| 16 | calendar + time-picker | 4.0k | opus | pending |
| 17 | notification + tabs + accordion + tree | 5.6k | opus | pending |
| 18 | match + standings | 2.6k | sonnet | pending |
| 19 | button + chip + badge + avatar + banner + card + divider | 3.4k | sonnet | pending |
| 20 | icon + picture + skeleton + loader + empty-state | 3.4k | sonnet | pending |
| 21 | pagination + breadcrumb + progress-steps + timeline + kbd + toolbar + description-list + copy-button + focus-ring | 3.2k | sonnet | pending |
| 22 | query-error + filter-overlay + floating-action + testing + internals | 2.0k | sonnet | pending |

Severity counts so far: —

Scope note: besides defects, each batch also collects improvement ideas (features, DX,
bundle size, UI/UX, testing) per user request.

## Summary of the worst problems

(to be filled as batches complete)

---
