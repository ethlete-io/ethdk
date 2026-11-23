---
status: accepted
built: a847c0398
decided: 2026-11-23
source: doc-agent session 2026-11-23 (morning), B672
---

# A design names the groups of its states

pages/sketches has 57 states. On 17.11. B371 grouped them by the first word of the state id under headings; B556
removed the groups the same day for a fold of the quiet states; da699c13a then wrapped the rows into columns so Fit
shows every frame. At 16 % no frame can be read. The human (German, verbatim): "und dieser 'fix' für die
übersichtlichkeit bei vielen frames ist wohl ein scherz oder?", then to a readable Fit floor with a state list in the
tree: "nein. das ziel ist ordnung. so ist das nur ein haufen screens ohne überblick."

Asked with three options (groups named in the design; automatic groups by the first word of the id; no groups but a
fixed flow order), the doc agent recommended the first. The human: "q6 ok".

1. **The design of a part names the groups of its states**, for example Vergleich, Kommentare, Fehler, Zoom.
2. **Each group is a row with a heading and its count.**
3. **Groups follow the flow**: the normal case first, then special cases, then errors.

From the question option, accepted by "ok", not said by the human: a state of a many-state part without a group is a
design check finding. This amends ADR 0137 (StateGrid gets no row groups) for parts with many states.
