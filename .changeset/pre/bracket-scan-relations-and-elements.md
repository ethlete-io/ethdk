---
'@ethlete/bracket': minor
---

Breaking: an unrelated round or match now has a `{ type: 'none' }` relation instead of a hidden placeholder, `createBracketElement`/`createBracketElementPart` return the value itself, and `isHidden`, `BracketElementType` and `MutableBracketElement` are removed; `ET3414` names a missing card.
