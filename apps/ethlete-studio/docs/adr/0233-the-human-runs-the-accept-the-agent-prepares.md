---
status: superseded by 0048
built: 57bac0dc0
decided: 2026-11-09
source: grill session 2026-11-09, finding 635
governs: ['libs/cli/src/lib/design/system/accept-command.ts']
---

# The human runs the accept that the agent prepares

ADR 0209 let an agent accept a direct edit that names the ADR it implements. On its first real use (the
`pages/sketches` gutter skip, finding 635) the Claude Code permission system denied
`et design accept ... --by claude-opus-5-5` as self-approval. The self-approval block stays. The agent makes the edit,
then writes the exact accept command with the ADR in the note, and the human runs it with `!` in the session. The
command must run without an interactive terminal, and the agent dry-runs it first. This replaces the agent accept of
ADR 0209 and covers the open accepts of B412 (`pages/start`, sdk `components/select`) too. The human: "q1b" (option b,
recommended).

Withdrawn the same day. ADR 0048 already removed go and accept as human gates: a direct edit to a merged part
without a picture change holds at once, so the gutter skip needs no accept at all. The human: "ich lese da schon
wieder das wort go" (finding 637).
