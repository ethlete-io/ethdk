---
'ethlete-studio': patch
---

Studio drops `drawnChanges$`, which read the design server's removed `changes` event; frames reload from the `parts` event alone.
