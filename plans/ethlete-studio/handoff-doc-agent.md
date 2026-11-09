# Doc agent handoff for the Mac night shift (2026-11-09, from ethlete-sdk-6d)

Run `/doc-agent` first. Scope of the night: ADR 0239 (e2e speed, then perf, then bugs; no features, not B249).
The human is away: collect design questions for the morning, record findings and decisions at once, answer the
builder. No grill round until the human is back.

## State at 18:00 on the desk PC

- Wait item (STATUS item 0) ended by ADR 0238: e2e step about 118 s (was 165-197 s), the Large scroll flake fixed at
  the cause (finding 647). Its rest is on the tool backlog and is the first night work: picture delay inside an
  existing repeat-gate run (no 4th run), the idle measurement against 90 s (ADR 0237; the Mac is idle, so measure
  there and print the load figure, finding 650), the disk check cache only if the idle runs are over 90 s, the 647
  bite proof through push-suite `exportCommit` (findings 651, 653).
- Then perf, then bugs. Tool backlog in STATUS "Werkzeug-Rückstand": 645, 649, 650, 652, 638, 617, 614, 618, 620, B438,
  off-centre sketches 628-633 (sketches are not night work; they need a pick).
- Findings today: 646-653 in `plans/ethlete-studio/design-to-code.md`. ADRs today: 0237, 0238, 0239.
- Builder handoff: `plans/ethlete-studio/handoff-builder-mac.md`.

## Rules the night keeps

- Technical questions are yours; product and design questions wait for the morning (one round, max 3 questions).
- Every defect: why did no tool catch it, and which tool fix stops it; record as a finding at once.
- One commit per round of records; `git commit -- <paths>`, never `git add -A`, never stash, never amend.
- Watchdogs at 01:35, 06:35, 11:35 (ADR 0239).
