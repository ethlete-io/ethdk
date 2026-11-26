---
'@ethlete/bracket': patch
---

`BracketMatchComponent` and `BracketRoundHeaderComponent` now type the optional `bracketRoundSwissGroup` input the bracket already passes, so a custom match or header component can read its round's swiss group without an `any`.
