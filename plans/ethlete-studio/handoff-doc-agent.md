# Doc agent handoff (2026-11-10, day shift, from ethlete-sdk-a6 / tmux claude-2)

Run `/doc-agent` first. The human is awake: grill rounds are allowed.

## Sessions

- Linux builder: ethlete-sdk-5d in tmux `claude-3@ethlete-sdk` (name changes after each `restart --process`; find it
  with ListAgents).
- Mac builder for B469/B479: tmux `claude@ethlete-sdk` on ethlete-mac. It reports through the Mac mailbox. Read it with
  `ssh ethlete-mac 'zsh -lc "cd ~/dev/ethlete-sdk && node .agents/skills/ethlete-agent-sessions/agent-sessions.mjs inbox doc-agent --wait 3500"'`
  in the background. Send with `... send doc-agent --to claude '<msg>'`.

## State

- Closed today: B474 (5fcf6202b), B475 (1c72a5026), B476 (9975af963), 694 built (2516fabc1), 696 built (3cfdb35d0),
  697 fix pushed (812a67070), 698 skill line (55ad943ce). B477 is Mac-only.
- ADR 0249 (38418d3e6, row B479): Studio ships CEF on macOS; the human: "q1ok". The Mac session commits the 3 cfg gates
  after its push of f08f0a3d1 (release CSP fix). Then close B469 (spike) and B479 with the Mac shas.
- Mac findings: the Mac session renumbers its 698/699 to 699/700 on merge (told by mailbox). Check after its push.
- Finding 701: a breaking lib commit runs the lib's whole `src/scenarios/` folder (builder work, approved).
- Finding 702 (URGENT, builder work): the agent-sessions spec and `restart --process` move or detach the human's tmux
  clients (twice today; human: "schon wieder"); the respawn passed the prompt twice. Fix: isolated tmux server in
  specs, no `switch-client` outside a human `run`, prompt once. Wait for the builder's cause report.
- STATUS.md: size check counts without padding now (budget 100000), cell cap 400 chars.
- ADR edits need an `'ethlete-studio': none` changeset in the same commit (698).
- `yarn -s lint:person-names` prints yarn help; run `yarn lint:person-names` without `-s`.

## Open questions for the human

None.
