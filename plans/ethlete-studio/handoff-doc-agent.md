<!-- Session state of the grill/docs agent. Delete once resumed. -->

# Handoff: grill/docs session (doc-agent), 2026-11-04 night

Talk to Tom in German (`/doc-agent` skill). Builder: `ethlete-sdk-02` (English, SendMessage). Findings go to
`plans/ethlete-studio/design-to-code.md` as `N\. ` paragraphs (last is 433), rows in `STATUS.md` (last is B365).
Latest ADR is 0186. Done rows are deleted from STATUS.md; an ADR's `open: B<row>` becomes `built: <sha>`.

## Rules Tom set today

- The builder works one topic at a time. Repeat every unanswered question in full, in its own message.
- Agents may restart the :4402 server (tmux `studio-serve`) without asking; a cli rebuild restarts it on its own.
- The repo-split measurement is parked until Tom brings it up again.

## Builder queue (agreed)

B363 (sample-mark rule, blocks `sketch ready`; builder works on it now) -> B365 (scroll in CEF: wheel over tree rows
427, frames lose their picture 430, live frame offset 432; picture always under the live iframe, ADR 0185, 0186) ->
B345/B346 sketch with findings 421-423, 425, 428, 431, 433 (ADR 0184; only after Tom merged merge-port, finding 401
allows one sketch per part) -> B362 (design-coverage check) -> B364 -> B361 + B360 -> B317 + B350 -> B353/B354 -> B356
-> refresh-icon sketch + code-notice c build + B352 pending-state sketch -> fold-question b build -> B334, B335, B336
-> push + red CI triage -> B332, B327, S4, S6b, S8 -> B340 -> B297, A36, A25. Rows without a place (B339 rest, B341,
B342, B344, B347, B349, B355, B358, B359) follow in the builder's order.

## Open

- `pages/sketches@merge-port` (variant a, 6f4b45040) is ready; "merge ok" sent to Tom. After his merge: delete row
  B357, set ADR 0183 `open: B357` -> `built: <merge sha>`, tell the builder to start the B345/B346 sketch.
- B343 is built (46177c36b) but not verified live: the builder checks it on the next real stale sketch.
- No open grill question. No open builder question.
