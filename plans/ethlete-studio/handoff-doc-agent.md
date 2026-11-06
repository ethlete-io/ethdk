<!-- Session state of the grill/docs agent. Delete once resumed. -->

# Handoff: grill/docs session (doc-agent), 2026-11-06 afternoon

I am ethlete-sdk-c4 (tmux claude2-2). Builder = ethlete-sdk-c0 (tmux claude2), the only builder. Tom is present but
annoyed: findings 514-518 were about needless/empty sketches sent to him and "klingonisch" German. Write to him in
plain words, no ADR numbers/flags/plan refs unless in brackets; decide anything that applies an existing decision
yourself and report it in one line (finding 517). Never send him a command or a pick you have not checked (518, ADR
0211: the builder sends a `design shot` of the sketch view first).

Last finding 518, last ADR 0211, last STATUS row B413. No grill question open.

## State of the five stale parts (finding 507)

- disclosure: closed (80f953c0c).
- pages/sketches: builder merges `new` itself, `--allowed-by "finding 500, ADR 0210" --by builder` (sent).
- shell-main ("ADR 0050, ADR 0209"), update-dialog ("ADR 0106, ADR 0210"), inventory ("Impl Q58, Impl Q56, ADR 0210"):
  builder accepts after its finding-515 CLI slice (agent accept with ADR/Impl Q ref, refusal exits 1).
- pages/start: Tom's accept (his q1ok) after shell-main; agents cannot record `--by tom` (finding 516), so Tom types
  it himself with `!` - first get the builder's shot AND a dry-checked command, then give Tom the line.
- Push of next blocked until these are closed (ff698951f verify needs studio-menu, flows, merge [records b7482bb5d],
  title-bar [missing notice hover/active/focus-visible: sketch per ADR 0106 - now agent-accepted per 0210], shell-main).

## Builder queue (as agreed)

S6 -> 515 slice -> accepts -> 514/518 slice (edit sketch never collapses new; two named buttons; old shows stored
merged pictures; zero-diff sketch never waits for Tom; open-picks list in Studio per 516, as a sketch for Tom) ->
title-bar notice states -> 511/512 -> B412 DIRECT-EDIT-PENDING rule -> S4, S7, S8, S5, B406, B407, B410, B413 rule.
Builder also edits .agents/skills/doc-agent/SKILL.md for finding 517 (I sent the text).

## Loose ends

- When c0 reports a slice: record as-built in design-to-code.md, close STATUS rows, mark ADR `built: <sha>`.
