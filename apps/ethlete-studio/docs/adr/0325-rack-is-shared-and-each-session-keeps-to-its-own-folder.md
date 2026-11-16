---
status: accepted
built: 88392b87a
decided: 2026-11-16
source: doc-agent session 2026-11-16 (late), after the fifagg session started its first e2e gate on rack
---

# rack is shared, and each session keeps to its own folder

This changes ADR 0258, where the human gave the guest PC `rack` wholly to the builder. The fifagg session now runs its
e2e gate on `rack` with 20 workers, in its own folder `C:\fifagg-e2e`. Asked whether that stays so, with the
recommendation that `rack` is shared and every session works only in its own folder, the human said: "Ok".

`rack` is shared by the SDK builder and the fifagg session. Each works only in its own folder: the builder in
`C:\b480`, the fifagg session in `C:\fifagg-e2e`. Neither touches the other's folder, and the game setup stays as it
is (ADR 0258).
