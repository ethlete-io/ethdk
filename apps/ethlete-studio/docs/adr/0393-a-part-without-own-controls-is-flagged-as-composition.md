---
status: accepted
open: B663
decided: 2026-11-20
source: grill session 2026-11-20 (afternoon), state grid screenshots
---

# A part without own controls is flagged as composition

The human, on the part state grid: "man sieht bei den screens auch sehr gut wo quatsch gebaut wurde aka einfach sub
components in ein design gesteckt wurden", then "eig würde ich sagen das sollte das system selbst merken".

A part with no own controls (every control belongs to an embedded part, ADR 0128) gets no interaction columns in its
state grid. Studio labels it as composition only, rather a page, and `design check` reports it when it still declares
interactions. Ownership is the existing computation (`isOwnControl`/`ownerOf`); no new declaration.

The human, asked to choose between this, a check finding only, or nothing, with the recommendation "this": "q1ok".

Cross-checked (ADR 0358): dropped a first option to move forcing off the part root, since the teal box is the diff
mark and "no force into embedded parts" already follows from ADR 0131.
