<!-- Session state of the grill/docs agent. Delete once resumed. -->

# Handoff: grill/docs session (doc-agent), 2026-11-04 evening

Talk to Tom in German (`/doc-agent` skill). Builder: `ethlete-sdk-02` (English, SendMessage). Findings go to
`plans/ethlete-studio/design-to-code.md` as `N\. ` paragraphs (last is 403), rows in `STATUS.md` (last is B346).

## Rules Tom set today

- The builder works one topic at a time (builder-agent skill, memory `full-speed-parallel-default`).
- Repeat every unanswered question in full, in its own message (doc-agent skill). Tom was annoyed by buried questions.
- Tom is tired of reporting stale sketches: until B343 is built, the builder checks and rebases after every merge.
- The repo-split measurement is parked until Tom brings it up again.

## Builder queue (agreed)

S6a port of pick a + merge (running) -> B339 commit (Tom's rule: kept unchanged marks may show early, new ones only
after the full listing) -> B343 auto-rebase after any merge or commit -> B345 + B346 (sketch rounds as crops of the
change, chrome at low zoom) -> pages/sketches agent-progress pick a (hand port of a only) -> refresh-icon sketch +
code-notice variant c build -> fold-question b build -> B334, B335, B336 -> push + red CI triage -> B332, B327, S4,
S6b, S8 -> B340 triage of 698 check findings -> B297, A36, A25.

## Waiting for an answer

- From the builder: the cause of the black "part" block in the sketch view (finding 403), and the list of sketch-view
  UI updates in the pipe. Tom asked "hatten wir nicht noch UI-Updates in der Pipe?" - answer him with it.

## Mac

`ssh ethlete-mac` works. Terminal.app has Screen Recording now: start GUI checks with
`osascript -e 'tell application "Terminal" to do script "<cmd> | tee /tmp/<x>.txt"'` and poll the file. The Mac
checkout has no husky hooks (B335): make no commits there.
