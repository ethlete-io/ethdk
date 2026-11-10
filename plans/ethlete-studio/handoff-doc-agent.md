# Doc agent handoff (2026-11-10, day shift, second part, from ethlete-sdk-a6 / tmux claude-2)

Run `/doc-agent` first. The human is awake: grill rounds are allowed.

## Sessions

- Linux builder: ethlete-sdk-3e in tmux `claude-3@ethlete-sdk`, role builder live (checked in /proc).
- Mac builder: tmux `claude@ethlete-sdk` on ethlete-mac, idle since 12:09 (CEF on macOS done). Mailbox:
  `ssh ethlete-mac 'zsh -lc "cd ~/dev/ethlete-sdk && node .agents/skills/ethlete-agent-sessions/agent-sessions.mjs inbox doc-agent --wait 3500"'`
  in the background. On the Mac, `tmux` needs `zsh -lc`.

## State

- Closed today (second part): B102, B437, B442, B443, B466, B469, B474, B475, B478, B479, B481. ADRs 0250 (Windows CEF
  spike waits for real hardware, B480) and 0251 (CEF plugin debug-port defects stay internal) recorded.
- Findings 702-709 in `design-to-code.md`. 702, 703, 704, 705 have as-built notes.
- Builder queue: 707 (ts(2307) on `@design-system` in sketches: generated tsconfig points at the gone
  `tmp/691-cli-lowered`, and `sketches/**` is not in `include`), 708 (lint `.ethlete/design/**`, fix button.ts:30 `!`),
  709 (app icon is the old mark: sketch first, then generate it from the logo part), then 706 (Stop hook: a commit or
  push turn with no report is blocked), then B482 (release smoke, CSP).
- For each of 707-709, write the cause as "Cause:" only after the builder's bite.
- B480 waits for the human's move to Windows.

## Open questions for the human

None.
