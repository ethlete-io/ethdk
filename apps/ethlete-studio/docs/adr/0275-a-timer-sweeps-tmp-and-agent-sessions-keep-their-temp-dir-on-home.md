---
status: accepted
open: B494
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

- A systemd user timer runs every hour, without Claude. It deletes in `/tmp` only our known test folders that are older
  than 6 hours. Caches (for example `node-compile-cache`, `et-design-harness-cache`) stay.
- Sessions that the agent-sessions script starts get `CLAUDE_CODE_TMPDIR` on a folder under `/home`, so a full `/tmp`
  does not stop their shell.
- The timer also sweeps old files in that `/home` folder, so the disk does not run full.
- When `/home` has less than 20 GB free, the timer plays the warning sound and writes one line where the agents see it.
- The human installs the timer once; the builder writes it and names the command.
