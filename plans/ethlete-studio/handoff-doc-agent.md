<!-- Session state of the grill/docs agent. Delete once resumed. -->

# Handoff: grill/docs session (doc-agent), 2026-11-04 late night

Talk to Tom in German (`/doc-agent` skill). Builder: `ethlete-sdk-02` (English, SendMessage). Findings go to
`plans/ethlete-studio/design-to-code.md` as `N\. ` paragraphs (last is 441), rows in `STATUS.md` (last is B378).
Latest ADR is 0192. Done rows are deleted from STATUS.md; an ADR's `open: B<row>` becomes `built: <sha>`.
The queue now lives at the top of STATUS.md ("Reihenfolge"); keep it there, not only in a handoff.

## Tom

Tom ended the day 2026-11-05 after the round below. Next session: ask him at the start whether he is there.

## Rules Tom set today

- The builder works one topic at a time. Repeat every unanswered question in full, in its own message.
- No agent edits product files under `.ethlete/design` while a sketch waits for Tom (finding 434).
- A slice runs only its touched specs and its own `yarn studio:e2e --case <text>`; full suites once per batch before a
  push (c431d0e50, findings 439, 440).
- :4402 runs inside Tom's Studio app (`nx tauri:dev`), not tmux; only Studio's restart restarts it (finding 436).
- Mac (ethlete-mac) is in standby; ask Tom before any slice needs it. Mac session `ethlete-sdk-54` knows.

## Queue (top of STATUS.md)

CI green (run 41924354824), then push -> B377 (ADR 0192) -> B372 -> B369 -> port app build -> B345/B346 (design session first,
sketch with variants; never revive the old changed-area code) -> A10 (B249 + B295, ADR 0190) -> B365 -> B370 -> B373 ->
B375 -> B376 -> B368 -> B371 -> B378 -> rest as listed.

## Open

- CI: the fresh builder (restarted after B367b) fixes run 41924354824 as its next slice: (1) Studio rules: stale design mocks, job builds only cli before
  `design check` (same in previous run); (2) Build: bundle goldens, table/password-input/stream-with-pip ~+20 KB, told
  the builder to diagnose, not update (a real growth goes to Tom); (3) WebKit: `cat /etc/machine-id` on macOS in
  `.github/actions/setup/action.yml`, from e6b59bdf4. Unit tests also red, sent to the builder (not inspected). Record a finding per job once the
  builder says why pre-push missed it.
- B365 explorer wheel lag is a regression from today (Tom). Suspect 7658705c1. Builder checks the diff for 10 min after
  B367b; small fix -> own slice, else B365 keeps its place. Waiting for the cause.
- B367 built (e459da21e, 3c67d2143); ADR 0187 built. Its e2e cases do not bite (finding 441, B378).
- Builder commits after 5524606cf are not pushed (3ba59b681, e459da21e, 3c67d2143, ...). Push with the CI slice once CI is green (Tom, ADR 0192).
- No open builder question.

## Last round (2026-11-05)

Q1 B377 right after CI green: ok (ADR 0192). Q2 no push with a red CI; the builder pushes with its CI slice: ok.
No open grill question.
