# A checkout and its worktrees are one attention

On 2026-09-24 the `fut-frontend` column drew three rows over the same afternoon: the main checkout
from 14:15 to 18:00, the `fut-frontend-altcha` worktree from 15:00 to 16:00 and the
`fut-frontend-cookie-consent` worktree from 15:00 to 15:15. The main checkout held the focused window
throughout; the worktrees only ran agent sessions.

`cutUnwatched` already booked an instant two sessions of one checkout held once, to the session the
user prompted last. A linked worktree has its own `streamKey`, so it was a second checkout to the cut,
and two checkouts at once are two things at once. The day screen then drew the worktree in the main
checkout's column, where the overlap read as the same hour booked twice.

**A main checkout and its linked worktrees are one attention.** Where two of them hold the same
instant, the one the focused window was on keeps it. Where the window was on none of them, the one
running the session the user prompted last keeps it, and where the user prompted none of them, the
oldest. What the others lose is reported as `behind`, not dropped, so the worktree's lane explains
its hole. A worktree running while its main checkout holds nothing keeps its minutes.

Two repositories that are not worktrees of each other are unchanged: their overlap is a day that ran
two things at once, which `concurrency` measures.

`BuildRowsOptions.worktrees` carries the map, as `linkedWorktreesOf` builds it. Without it every
checkout is its own attention, which is the rule this replaces.
