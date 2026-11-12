---
status: accepted
built: 98cd69ccf
decided: 2026-11-12
source: chat with the doc agent 2026-11-12 (early morning)
---

# A timer sweeps /tmp, and agent sessions keep their temp dir on /home

In the night of 2026-11-12, `/tmp` (a tmpfs with a fixed inode count) ran full with old test folders. Specs failed with
ENOSPC, and then Claude Code refused every shell call in every session, because it writes command output to
`/tmp/claude-1000`. The permission check refused the agents' sweep, so the night shift stood still until the human swept
`/tmp` by hand. The human: "das darf die nachtschicht nicht blocken. wir brauchen da eine lösung". To the two questions
(a timer sweeps `/tmp`; sessions keep their temp dir on `/home`) the human answered "q1ok q2ok müssen dann sber sufpassen
das die festplatte nicht volläuft":

- A spec run fails when a new folder in `/tmp` is left after it; the message names the spec. This stops the cause:
  specs that create a folder and do not delete it. The builder builds this check first, then fixes every spec it finds.
- A systemd user timer runs every hour, without Claude, as a safety net only. It deletes in `/tmp` only our known test
  folders that are older than 6 hours. Caches (for example `node-compile-cache`, `et-design-harness-cache`) stay.
- Sessions that the agent-sessions script starts get `CLAUDE_CODE_TMPDIR` on a folder under `/home`, so a full `/tmp`
  does not stop their shell. Only Claude Code's own files move (321 MB, 5,541 files on 2026-11-12); the test folders stay
  in `/tmp`. The timer also deletes old files in that folder.
- No warning sound and no free-space check on `/home`. The human asked "warnton? was soll mir das bringen in der
  nachtschicht" and "das fühlt sich sn als hätten wir das problem nur suf die festplatte verschoben. heist die nutzt nun
  ab durch hsufenweise temp files und gewonnen ist null". The answer: only Claude Code's small folder moves to `/home`,
  and the leak check stops the cause. The human confirmed with "ok".
- The human installs the timer once; the builder writes it and names the command.
