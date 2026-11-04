<!-- Session state of the grill/docs agent. Delete once resumed. -->

# Handoff: grill/docs session (doc-agent), 2026-11-04 late evening

Talk to Tom in German (`/doc-agent` skill). Builder: `ethlete-sdk-02` (English, SendMessage). Findings go to
`plans/ethlete-studio/design-to-code.md` as `N\. ` paragraphs (last is 433), rows in `STATUS.md` (last is B365).
Latest ADR is 0186. Done rows are deleted from STATUS.md; an ADR's `open: B<row>` becomes `built: <sha>`.

## Rules Tom set today

- The builder works one topic at a time. Repeat every unanswered question in full, in its own message.
- Agents may restart the :4402 server (tmux `studio-serve`) without asking; a cli rebuild restarts it on its own.
- The repo-split measurement is parked until Tom brings it up again.

## Builder queue (agreed)

One-variant sketch for the "Agent portiert nach Merge von <part>" mark on pages/sketches (Tom picks it) -> B357 (sample
data, ADR 0183) -> B345/B346 with findings 421-423 (ADR 0184) -> B362 -> B361 + B360 (building state for a missing dist, ADR 0182) -> B317 + B350 -> B353/B354
-> B356 -> refresh-icon sketch + code-notice c build + B352 pending-state sketch -> fold-question b build -> B334, B335,
B336 -> push + red CI triage -> B332, B327, S4, S6b, S8 -> B340 -> B297, A36, A25. Rows without a place (B339 rest,
B341, B342, B344, B347, B349, B355, B358, B359) follow in the builder's order.

## Open

- B343 is built (46177c36b) but not verified live: the builder checks it on the next real stale sketch.
- The Mac perf session (B348, ADR 0181) is finished; its probes and logs stay untracked in `tmp/mac-perf`.
- Port-mark sketch `pages/sketches@merge-port` (variant a, 6f4b45040) is ready again; "merge ok" sent to Tom. After his merge:
  delete row B357, ADR 0183 `open: B357` -> `built: <merge sha>`. Builder does B363 meanwhile (finding 401 blocks a second
  sketch on pages/sketches).
- Finding 427: B365 measures it right after B363, before B345/B346 (ADR 0185).
- Finding 427 (explorer swallows wheel events, then scrolls late): the cause is asked from the builder.
- Finding 433 (comparing-narrow counts as changed but looks the same): cause asked from the builder.
