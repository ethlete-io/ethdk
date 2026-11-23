---
status: accepted
open: B676
decided: 2026-11-23
source: doc-agent session 2026-11-23 (morning), B676
---

# Each layer presents its frames its own way

Every part shows its states as loose frames in rows (ADR 0366: a grid of tiles, or one row per state and one frame per
width). The human called it "einfach unübersichtlich": sketch-status-badge shows 7 frames of width 200 in a long column,
variant-cell shows its states as loose frames without the place they sit in ("keine ahnung was mir das hier sagen
soll"), and sketch-question shows only two lines of text ("irgendwie witzlos").

Offered one presentation per layer or one tidied board format for all, the human answered "A" (per layer). Offered
that a part which is only text becomes a state of the part it sits in, the human answered: "q11 ok aber das darf halt
nicht darin resultieren dass wir z.b den ganzen sketches frame nochmal und nochmal rendern." sketch-question sits
directly in pages/sketches; offered to cut the sketch head out of that page as its own part, the human answered: "ja
das ist deutlich besser wenn wir da dann den kompletten kopf als komponente sehen."

1. **One presentation per layer** (option text, accepted with "A"):
   - Foundations: a spec sheet.
   - Components: variants compact side by side; an interaction grid only for a part with real interactions (ADR 0393).
   - Elements: the element in a crop of its real context, the context dimmed.
   - Pages: screens grouped by flow (state groups, ADR 0407).
2. **A part that is only text is not a part of its own** (option text, accepted with "ok"). It becomes a state of the
   part it sits in. The design check reports such a part.
3. **No whole page again and again**: the human's sentence above is the limit for points 1 and 2.
4. **The sketch head is its own component**: question, status badge and variant bar, cut out of pages/sketches. The
   question becomes its states, short and long.

How the dimmed context differs from the dim that means "did not change" (ADR 0410) is a look question: the builder
decides it in a sketch. Amends ADR 0366 and ADR 0368 for the frame layout of a part.

Cross-checked before recording: it found that no sketch head part existed, which led to the sketch head question.
