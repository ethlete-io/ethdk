# Aufräumen: alles Angefangene zu Ende bringen (07.11.)

Tom (07.11.): "Alles angefangene bitte sinnvoll zuende bringen." Gilt für jeden lokalen `desk/*`- und jeden
`origin/tank/*`-Branch. Keine neuen Themen. Eine Gruppe nach der anderen, keine parallelen Agents, alles landet auf
`next` im Haupt-Checkout.

Je Branch: prüfen, ob die Änderung schon in `next` ist (andere SHA). Sonst auf `next` bringen, WIP fertig bauen, Specs
und Lint grün, Changeset, Commit mit Pfaden. Hält etwas nicht oder ist überholt: verwerfen, mit einem Satz Grund
hier. Design-Fragen gehen nicht an Tom: die Empfehlung bauen.

## Schon in `next` (nur Branch löschen)

desk: B120, B212, B338, B354, B362, B369, B419, B353 (kein Gewinn, entschieden). tank: b112, b339-needs, b402,
b417-rest, hooks-worktree, studio-theme-switch-type, worktree-agent-aeabaa9c9dee47bbf, worktree-agent-afba22bc5202ed617,
webkit-revert-wt (nicht genommen, entschieden), wip/b321-stacking-fix (verworfen, a4d2db7d6).

## Gruppen

1. **cli klein:** desk B234, B285, B359, B364, B390 + tank/b390, B417 + tank/b417-target, B305, B308, B341 + tank/b341,
   B358, tank/b114.
2. **Gates und Tools:** tank/b380, b382, b393, b394, b396, ci-gates-on-next, w3-gates-a, w3-gates-b, w3-b379-b364,
   w3-cli-a, tree.
3. **cli groß:** tank/conflicts-land (= f557-hub-split + b412), b392, b397, b407, worktree-agent-a66238bcffb60bf03,
   b416-next, worktree-agent-a13203d886f4f7c9c, b217 (WIP 494af9c34).
4. **Studio-App:** desk B306, B355, B356, B346, B345, B365, B370, B415 + tank/b415-sketch-final, clifix; tank/webkit-tla-wt.
5. **Tom von Hand:** tank/design-data (seine Studio-Daten).

## Ergebnis je Branch

(Die Gruppen tragen hier ein: Branch, gelandet als SHA oder verworfen mit Grund.)

- desk/B234 → gelandet in diesem Commit (Leerraum-Zweige im glued-interpolation-Check, Spec + Beißprobe grün).
