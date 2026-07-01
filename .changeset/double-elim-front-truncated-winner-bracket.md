---
'@ethlete/cdk': patch
---

Position winner rounds correctly when the winner bracket starts after round 1

Some double elimination brackets omit the early winner rounds — e.g. a small bracket where the first lower round is seeded directly from a group phase and has no winner round feeding it. The grid previously placed the first present winner round in the leftmost column, so every winner round was one column too far left relative to its drop-in lower round. The grid now detects the missing leading winner rounds (a complete winner bracket has lowerRounds / 2 + 1 rounds) and leaves those leading slots empty, so each present winner round lines up above the lower round its losers actually drop into.
