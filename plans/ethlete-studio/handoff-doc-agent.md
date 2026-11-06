<!-- Session state of the grill/docs agent. Delete once resumed. -->

# Handoff: grill/docs session (doc-agent), 2026-11-06 ~11:40

I was ethlete-sdk-c4 (tmux claude2-2). Tom is present. No grill question is open. Last finding 492, last ADR 0203,
last STATUS row B403.

Tom said "push ok" for next. Local next has origin/next merged (c09d4b492). The push is blocked only by the pre-push
design-rules-gate: 40 IMPLEMENTATION-UNCOMPARED after A1. c8 is comparing the 8 parts; flows/inventory/merge show
21-31 px DIFF in every state (suspected: the new title bar inside each page, c8 confirms). When c8 says the gate is
clean: `export NX_NO_CLOUD=true; git fetch; git merge origin/next if behind; git push origin next`, and log to a file
in the scratchpad (the output is huge). Never skip the hook. Tom's "push ok" covers this push.

Builders:

- **c0** tool builder. TOP PRIORITY now finding 492: Tom says the design CLI is far too slow ("absolut inakzeptabel",
  not 4 -> 1 min). Targets (warm): compare one part <= 5 s, `compare --affected` 8 parts <= 15 s, `sketch ready` <= 10 s,
  `check --rules` <= 3 s, full `design check` <= 60 s; direction: one resident process with harness, Chromium pool and
  input-hash picture cache, CLI only sends requests. c0 owes a plan (phases, expected seconds, slices, whether it needs
  a second tool builder) around 12:10. If it asks for a second builder, start one (agent-sessions skill) and split the
  slices. Queue after: B402 (ADR 0203 `--affected` + commit check), shell-main "changed outside a sketch" (suspect
  fea9ac862), B401 (ADR 0201), 490 rule part, C1, C4, 485, B392, 481, 483, 484, 486.
- **c8** UI builder. Fix the 3 page DIFFs, verify all 8 parts, tell me when the gate is clean; then the notice-hint
  sketch redrawn with macOS and linux-left (finding 490; do not show Tom before macOS is in); then A2. Queued sketch:
  components/rail-bubble (489). Under ADR 0202 it only investigates tool gaps that block it.
- **cb** SDK builder. Fixing migrator gap A (creator in its client's file), B (async validator, item 21b), unused
  imports, each with a fixture from the real fifagg shape, then the replay again; it owes me the new tsc delta (34 new
  errors before).

Notes: commits in this repo carry no trailers (commitlint refuses them). An ADR with `open:` needs its STATUS row in the
same commit; run `node tools/scripts/check-studio-adrs.mjs` before every plan commit.
