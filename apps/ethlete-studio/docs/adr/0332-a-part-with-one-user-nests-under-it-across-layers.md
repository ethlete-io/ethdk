---
status: accepted
open: B560
decided: 2026-11-17
source: doc-agent session 2026-11-17 afternoon, part tree
---

# A part with one user nests under it across layers

Supersedes the layer limit in ADR 0294. The human: "diese hyper spezifischen sub parts dann besser einordnen. zb als
sub node der sketches page. aktuell schmeißen wir den kram ja einfach immer in elements und components als eine flache
hierarchie. so sieht man schwer was eig zusammengehört". Offered (A) nesting a part with exactly one user under that
user in any layer, or (B) keeping nesting within one layer; the human answered "q4ok" to A.

The part tree shows a part under its user when exactly one part uses it, in any layer, with a small tag naming its own
layer. Nothing declares the nesting; it is worked out from use. A part that gains a second user moves back to its
layer. A base part from the SDK never nests.
