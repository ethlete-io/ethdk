<!-- Session state of the grill/docs agent. Delete once resumed. -->

# Handoff: grill/docs session (doc-agent), 2026-11-05 night

Tom shut down the PC. No open grill question; no collected design question. Findings: last is 474 (stale vitest
cache; cause asked from 0d), last STATUS row B396, last ADR 0197.

- B396 (ADR 0197) still needs Tom's confirmation directly in the builder session. Tell him at once.
- CI on next: 42073982842 (59c0e0745) success incl. publish; 42076042344 (9c687f280)
  pending. Check `gh run list --branch next` and tell Tom.
- Unpushed ff batch for the builder: 8c060133c, 088ef29fb, 69b6f2adc, 00137ba55 (B385 gql tasks, item 27 pins,
  devtools mount runtime + migrator). Builder runs the full ci-check before the push. Recorded in
  `plans/et-update-findings.md` sections 7 and 10.
