---
status: accepted
built: c9dc8788d
decided: 2026-11-06
source: doc-agent session 2026-11-06, 22:30
---

# Builder and doc agent work through the night without Tom

Tom: "ihr arbeitet die nacht durch auch ohne mich es gibt genug zu tun. sicher dich ggf noch mit claude-at ab falls
ihr in limits läuft. reset ist um 1:30 nachts, 6:30 11:30. diese können dann dich und builder wieder triggern und wenn
erflgreich wieder gekillt wierden". Both sessions keep working while Tom is away; design questions for Tom are
collected, not sent, and work goes on with the next item that needs no decision. Three one-shot claude-at watchdogs
(`kick-01`, `kick-06`, `kick-11`, 01:35, 06:35 and 11:35 on 2026-11-07, five minutes after each reset) read both tmux
panes, type a resume line into a session that stopped at a usage limit, log to `/tmp/dx/kick-report.log` and exit.
