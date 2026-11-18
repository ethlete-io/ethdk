---
status: accepted
built: 289c67603
decided: 2026-11-18
source: chat of the human with the analysis session (ethlete-sdk-3f) 2026-11-18, its fifagg consumer review approved by the human, relayed by the analysis session
---

# A consumer repo keeps its decisions and sends SDK requests through one channel

The human asked the analysis session (German, verbatim):

> was sagst du zur fifa session? sie macht und macht. bei sdk issues und fragen meldet sie sich beim doc agent. das ist
> quasi noch eine 4te variante ergo

On the four points below he answered: "das klingt auch gut soweit". The points are the analysis session's text,
approved by the human. A consumer is a session in another repo that uses the SDK; fifagg is the first.

1. A consumer session keeps its own decisions in its own repo. The SDK records only ADRs about the SDK interface.
2. The SDK doc agent does not manage another repo's session. Slice-done reports and questions for the human from a
   consumer do not go to its inbox. This ends the doc agent running a consumer's night shift.
3. One channel into the SDK, fixed format: what is missing, how to reproduce it, what the consumer does meanwhile, and
   whether it is blocked. Batched; only a blocked consumer interrupts at once. It becomes a row in
   `plans/sdk/STATUS.md` (ADR 0354), not in the Studio row table.
4. The plan-file system of ADR 0354 applies to the consumer repo too. Amended by ADR 0374: the consumer gets its tooling from `@ethlete/agent-rules` and fills in only its own content.

The doc agent settled one detail without a further question: each `plans/sdk/STATUS.md` row also gets an entry in the
one builder queue, so ADR 0355 point 1 (one list of live work) holds.

What stays: a consumer bumps to a prerelease the same day and keeps no local patches.
