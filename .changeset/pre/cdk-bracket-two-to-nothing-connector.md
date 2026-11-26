---
'@ethlete/cdk': patch
---

Bracket: fix the missing losers-bracket → grand-final connector in a double-elimination bracket that has no bracket-reset (reverse) final. The `two-to-nothing` final relation resolved and stored its lower input from the winners round instead of the losers round, so the line was never drawn. Brackets that include a reverse final were unaffected.
