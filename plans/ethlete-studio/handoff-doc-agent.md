<!-- Session state of the grill/docs agent. Delete once resumed. -->

# Handoff: grill/docs session (doc-agent), 2026-11-06 ~15:30

I am ethlete-sdk-c4 (tmux claude2-2). Builder = ethlete-sdk-c0 (tmux claude2). New: Mac perf session in tmux
`mac-perf@ethlete-sdk` (measure only, prompt in .ethlete/mac-perf.prompt.txt, reports to c4 by SendMessage; if it
is not in ListAgents, answer it by `tmux send-keys -t mac-perf@ethlete-sdk -l '<text>'` then Enter). Told it: use a
separate checkout ~/dev/ethlete-sdk-perf on the Mac (the old one has foreign uncommitted work). Its findings go to
c0 through me.

Tom is present on and off ("afk" / "re"). Write German, plain words. Last finding 523, last ADR 0213, last STATUS row
B416. No grill question open.

## ADR 0213: HARD FOCUS on performance

Only perf work and only perf topics to Tom until `design timings` shows a warm studio compare <= 10 s (after an edit
too) and a full studio check <= 60 s. Push of next parked ("der push ist solange auch egal"). Hard short timeouts on
every run (2x target); a timeout is a result. Exits/times from `design timings`, never a shell pipe. Perf order
follows measured phases only (my unmeasured guess cost one slice, see c348e8af1 note).

## B416 state (all in design-to-code.md under findings 519-523)

Built: a1405e348 (parallel shots, pane cap), 361d96eca (S4 cache), 0df8f2073 (pane counter), a3a1e5c35
(compare-actions). Resident numbers: sketches warm 3.9 s, after edit 9.4 s; start 1.2/3.9 s.
Running at c0: phase 4+5 - (d) cancel the resident request when the client dies (first), 2.4 s gap outside any phase,
concurrency 6/8, settle cap named problem, 10 s target + slowest phase print, shared harness wait. Then Studio page
switch (finding 523, ADR 0186 applied to all frame views; a measure subagent runs now on icons<->logo and the
shell-main sketch; numbers + cause come to me before build; also the scroll pop-in on elements/shell-main@edit, frames re-empty on
scroll-back - sent to c0). Closing checks: resident path numbers, a real one-part
edit in a scratch copy + the 519 check. Then S7 (full check; c0 suspects the logged 16 s "check (full)" runs were not
full), S8, S5.

## Loose ends

- On each c0 report: record as-built in design-to-code.md (after the last B416 paragraph / finding 523), commit
  plan files only, no trailers (commitlint rejects them).
- Queued outside perf: pages/sketches DIFF on every state (far-out 2446 px); 514/518 slice, title-bar notice states,
  511/512, B412, B406, B407, B410, B413-B415; pages/start accept by Tom (after shell-main).
- .agents/skills/doc-agent/SKILL.md diff was committed by c0 in 8ae283f82.
