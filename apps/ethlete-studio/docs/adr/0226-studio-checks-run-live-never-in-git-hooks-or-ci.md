---
status: accepted
open: B424
decided: 2026-11-07
source: desk session 2026-11-07, the human on the long design checks
---

# Studio checks run live and fast, never in git hooks or CI

The human: "ich bin auch noch immer absolut kein fan davon dass wir uns hier auf ci verlassen müssen dass du nicht gegen das
system gearbeitet hast / dinge vergessen hast beim design. das ist grundsätzlich einfach nur falsch. diese ewigen checks
sollte es eigentlich gar nicht erst brauchen", then: "für studio sollten git hooks UND ci tabu sein. wenn dort checks
landen die dann auch noch fehler finden dann ist studio schlicht unbrauchbar. ALLES muss live passieren und extrem
schnell sein. ewig auf checks warten ist keine option. breche aus dem dev mindset aus. ein designer der nacher studio
nutzt nutzt eben nur das. er hat keine ahnung von git. und auch nicht von ci."

The user of Studio is a designer who knows neither git nor CI. No Studio or design check runs in a git hook or in CI;
the design gates leave `.husky/*` and `.github/workflows/*` (this supersedes the CI backstop of ADR 0225). Drift from
the design is prevented where code is written: app code is generated from or bound to the design, and an edit that
would leave it is refused at edit time. What still needs checking runs live in Studio while the designer works, fast
enough that nobody waits on it. Each performance or gate change first asks whether construction can make a check
unnecessary; deleting the check wins over making it faster.
