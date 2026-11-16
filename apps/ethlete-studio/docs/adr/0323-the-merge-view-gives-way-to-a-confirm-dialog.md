---
status: accepted
built: 3d78e9baa
decided: 2026-11-16
source: doc-agent session 2026-11-16, the human during the comment structure round
---

# The merge view gives way to a confirm dialog

The human: "Variante wählen & die merge Ansicht ist nochmal ein eigenes Thema. Ich würde die gerne entfernen. Ich
halte die für überflüssig. Ein einfaches Confirm Modal. Der merge Grund Input kann weg komplett. Den habe ich noch nie
gebraucht."

- Picking a variant no longer opens the merge view (the page with picked, changed, where-used and unchanged states).
  It opens a plain confirm dialog; confirming merges the variant.
- The merge reason input goes away completely.
- The deeper merge-view rework ADR 0047 left open is void: there is no merge view to rework.
