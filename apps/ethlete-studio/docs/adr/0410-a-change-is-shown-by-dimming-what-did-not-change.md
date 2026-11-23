---
status: accepted
built: 1a1ecc316
decided: 2026-11-23
source: doc-agent session 2026-11-23 (morning), B675
---

# A change is shown by dimming what did not change

A state grid outlines the whole element that differs from rest in Studio's accent colour (ADR 0368). In Studio that is
the same teal as the product's focus ring, so the outline reads as part of the component, and in an interaction grid
every cell differs from rest, so every cell is outlined. The human (German, verbatim): "das hatte ich auch schon
geschrieben, dass diese 'changes' outline das wirkt als wäre sie teil der component und somit ein fehler. und teils
ist das auch einfach noch nutzlos. [...] was bringts mir wenn die ganze komponente als geändert gilt". The earlier note
was not recorded anywhere.

Offered a head mark, a pixel mark behind a switch, or both, the human answered: "alles doof. ich denke wir sollten die
outline einfach weg lassen und eben den part dunkler machen der unverändert ist. das haben/hatten wir auch schon".

1. **No change outline.** Studio draws no outline around a changed element in a frame.
2. **What did not change is drawn darker**; what changed stays at full brightness. The sketch compare already dims
   unchanged states (variant-cell, pages/sketches); the state grid uses the same dim.

Amends ADR 0368 for change marks: pins and the merge preview outline stay.
