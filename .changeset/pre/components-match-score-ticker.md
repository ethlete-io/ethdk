---
'@ethlete/components': minor
---

Match card: live scores now roll when they change - old value out, new value in, with a flash on the side
that scored - plus a `scoreChange` output carrying the side and delta for your own effects. Only while the
match is live, never on first render, instant under reduced motion; `animateScoreChanges` turns it off.
