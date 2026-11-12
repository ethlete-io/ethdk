---
status: accepted
open: B499
decided: 2026-11-12
source: chat with the doc agent 2026-11-12 (morning), answers to the two open rules of ADR 0279
---

# A fix owns what it breaks, and a group closes on proof

ADR 0279 left two rules open. The doc agent asked: a defect that a fix causes or reveals gets no new number unless it
blocks something or CI is red; and a group row closes only when each finding is built, closed or parked with a reason.
The human answered (German, verbatim):

> Q1 – Ja, mit zwei Änderungen. „Verursacht" und „aufgedeckt" trennen. Einen Fehler, den die Reparatur selbst
> verursacht, behebt der Builder im selben Slice oder er nimmt die Reparatur zurück. Ein Fehler, der vorher schon da war
> und nur sichtbar wurde, wird nicht mitrepariert: Er bekommt eine Zeile in der passenden Umbau-Gruppe oder in der
> Park-Liste, ohne Nummer und ohne Ursachensuche. Sonst wandert die Schleife nur in den Slice hinein, und der Slice wird
> nie fertig. Ausnahme enger fassen. Eine Nummer gibt es nur bei rotem CI. „Blockiert etwas anderes" lässt sich fast
> immer behaupten. Zusatz: Braucht eine Reparatur mehr als zwei Folge-Reparaturen, wird sie zurückgenommen und der
> Ansatz neu gewählt. Das war das Muster hinter der Kette 963 → 973 → 982 → 983.
>
> Q2 – Ja, aber „fertig" braucht einen Beweis. Parken mit Begründung ist die Hintertür: Der Builder kann damit jede
> Gruppe leer parken. Besser: Jede Umbau-Zeile bekommt vor dem Start einen messbaren Beweis für die ganze
> Fehlerklasse. Beispiele sind „Sketch-Check unter 10 s" oder „E2E mit Scrollen, Bearbeiten und Warten ohne leere
> Zelle". Die Zeile schließt, wenn dieser Beweis grün ist und jeder Befund gebaut oder geschlossen ist. Geparkte Befunde
> aus einer Gruppe stehen im Schichtbericht an dich, mit Grund. So entscheidest du, ob das Parken in Ordnung ist, und
> nicht der Builder.

- A defect that a fix causes: the builder fixes it in the same slice, or reverts the fix. No new number.
- A defect that existed before and a fix only reveals: not fixed along. One line in the matching group row or in
  `plans/ethlete-studio/parked-suspects.md`, no number, no cause hunt.
- A new finding number only when CI is red. "It blocks something else" is no longer a reason.
- A fix that needs more than two follow-up fixes is reverted, and the approach is chosen again.
- Each group row (B498-B504) gets a measurable proof for the whole defect class before it starts.
- A group row closes when its proof is green and each finding is built or closed.
- A finding a builder parks out of a group goes into the doc agent's shift report to the human, with its reason; the
  human decides whether the park stands.
- This replaces the "or when blocking" part of ADR 0276 for new findings.
