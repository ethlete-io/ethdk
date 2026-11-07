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
- desk/B285 → gelandet in diesem Commit (Regel COMMAND-TEXT, für studio an; Tag-Erkennung zitatfest gemacht, 0 Treffer im echten Repo).
- desk/B359 → gelandet in diesem Commit (Probe-Ordner in serve.spec.ts anlegen; Stress 4/4).
- desk/B364 → gelandet in diesem Commit (Spec-Fälle covers, list/check mit unbekanntem Flag, unbekannter Unterbefehl; Exit 2 bleibt).
- desk/B390 + origin/tank/b390 → gelandet in diesem Commit (desk/B390 als Basis, Signatur argv-Array wie tank/b390, dessen prettier-Aufrufe in check-format/merge übernommen; leere prettier-Ausgabe gilt als Fehler).
- desk/B417 + origin/tank/b417-target → gelandet in diesem Commit (desk/B417 ist tank/b417-target ohne die fremde vitest-Abhängigkeit; Specs, Lint grün).
- desk/B305 → gelandet in diesem Commit (Hook prüft lange Design-Befehle nur an Befehlsposition; schließt B126; Hook-Spec 38/38).
- desk/B308 → gelandet in diesem Commit (Ratchet-Prüfung auf Personennamen; Baseline auf den Stand von heute neu geschrieben, da next schon neue Treffer hatte; Umbenennung --by tom → human bleibt offen in B308).
- desk/B341 → Zeilen-Schluss gelandet in diesem Commit; origin/tank/b341 → verworfen: schon in next als b20f3d5b7 (gleiche Dateien, gleiche Änderung).
- desk/B358 → gelandet in diesem Commit (nur Doku: B358 und B334 geschlossen, Spec-Typecheck bleibt in CI nach ADR 0225).
- origin/tank/b114 → gelandet in diesem Commit (Notizsprache, NOTE-LANGUAGE, `sketch note --round`; Konflikte in Usage-Zeilen und Spec gelöst, Hilfe angepasst).
- origin/tank/w3-gates-b → gelandet in diesem Commit (984042b90: commitlint über den gepushten Bereich in CI und Pre-push; dc7a9a06d und f8cd875e0 waren schon in next als 7e3685dcf und 94606402c).
- origin/tank/b380 → verworfen: Feature schon in next als 377879f5a; der WIP-Commit setzt nur STATUS-Zeilen (B318–B336) auf einen älteren Stand zurück.
- origin/tank/b382 → verworfen: schon in next als 2e23578d1; WIP-Commit ist dieselbe veraltete STATUS-Rücksetzung.
- origin/tank/b393 → verworfen: schon in next als fd611c3ac (gleicher Code, andere design-to-code-Notiz); WIP-Commit ist die veraltete STATUS-Rücksetzung.
- origin/tank/b394 → verworfen: schon in next als f77a48873; WIP-Commit ist die veraltete STATUS-Rücksetzung.
- origin/tank/b396 → verworfen: schon in next als 3182bd02f; WIP-Commit ist die veraltete STATUS-Rücksetzung; ADR 0197 auf built: 3182bd02f gesetzt.
- origin/tank/ci-gates-on-next → verworfen: beide Commits schon in next (3ba0a690b, 96639086f); der WIP-Commit ist ein alter Baumstand, der die System-Seite und neuere cli-Arbeit zurückdrehen würde.
- origin/tank/w3-gates-a → verworfen: beide Commits schon in next (7d8e0ae63, 1d2cbaa77); der WIP-Commit macht nur eine Prettier-Umbrechung in cli-related-map.mjs rückgängig.
- origin/tank/w3-b379-b364 → verworfen: beide Commits schon in next (ec09123c5, a3b204c2d); die WIP-Notiz zu B364 ist durch die As-built-Notiz von desk/B364 ersetzt.
- origin/tank/w3-cli-a → verworfen: schon in next als 4373e3a4c; die WIP-Datei check-staged-plans.mjs liegt identisch in next.
- origin/tank/tree → verworfen: der einzige WIP-Commit löscht 4664 Dateien (kaputter Baumstand).
- origin/tank/conflicts-land, Teil f557-hub-split → gelandet in diesem Commit (Aufteilung von `design/paths.ts`; 13 seither in next neu dazugekommene `paths`-Importe umgehängt; der commitlint-Commit e6b6e12a3 war schon in next als 984042b90).
- origin/tank/b407 → gelandet in diesem Commit (WIP fertig: Signatur `by`/`cmd`/`pid` für Ready-Markierung und Skizzen-Wahl; Konflikt mit `--decided-by` gelöst, Aufrufe in den seither aufgeteilten Specs nachgezogen; 20 Specs, Lint grün).
- origin/tank/conflicts-land, Teil b412 → nicht gelandet: die neuen DIRECT-EDIT-PENDING-Einträge in `studio/rule-baseline.json` verstoßen gegen ADR 0201 (Baseline darf nur schrumpfen), und die vier Studio-Treffer schließen nur Toms Skizzen-Entscheidungen; Folgeschritt in B412.
- origin/tank/b392 → verworfen: Spec-Aufteilung schon in next als 58a94e357; der WIP-Commit setzt nur STATUS-Zeilen auf einen älteren Stand zurück.
- origin/tank/b397 → verworfen: schon in next als d0122053a; der WIP-Commit fügt nur zwei Leerzeilen in `sdk-selectors.ts` ein und setzt STATUS zurück.
- origin/tank/worktree-agent-a66238bcffb60bf03 → verworfen: b5c266bfc schon in next als eb0546d31, der WIP (Zoom-Chip-Zustände) als c82aa7d4f.
- origin/tank/b416-next → verworfen: der WIP (Theme-Schalter ohne `current`) ist schon in next als 947865686.
- origin/tank/worktree-agent-a13203d886f4f7c9c → verworfen: überholt durch 9bc56da98 (System-Seite portiert, `exception-list` durch `exception-store` ersetzt).
- origin/tank/b217 → verworfen: bf6fcd97e schon in next als 074e32805; der WIP 494af9c34 ist ein älterer Entwurf, den 074e32805 in `complete.ts` ersetzt hat.
- desk/B306 → gelandet in diesem Commit (FailedShots als `defineRootProvider`, Chip und Popover „N Bilder fehlen“; Specs, Lint, Typecheck grün; Retry-Knopf bleibt offen in B306).
- desk/B355 → gelandet in diesem Commit (async-Fehler außerhalb des Falls → FAIL und neuer Worker; zwischen den Fällen endet der Worker mit 1 statt den Fehler zu schlucken; mit zwei Wegwerf-Fällen geprüft).
- desk/B356 → verworfen: der WIP ist nur der WebKit-Budget-Fall samt CI-Schritt; der Zoom-Fix fehlt, der Fall wäre in CI rot (gemessen p50 45–49 ms), und er kollidiert mit next; Übernahme des Falls nach dem Zoom-Fix steht auf B356.
- desk/B346 → 975505b03 gelandet in diesem Commit (`sketch new` rebast Importe eines gehobenen `shared/`-Ordners richtig; Sketch-Specs grün); 4f56e7893 (Kopf-Tag) zurückgehalten: Skizze `pages/sketches@head-zoom` ist noch in Arbeit ohne Wahl, e2e 0/4; der WIP-Commit ist nur Toms Skizzendaten.
- desk/B345 → verworfen: 0de880f4d ist schon in next als e7a9900d8 (gleicher Inhalt); der WIP-Commit ist nur Toms Skizzendaten (u. a. `pages/sketches@head-zoom`), die Tom selbst übernimmt.
- desk/B365 → verworfen: nichts gebaut, der WIP-Commit ist nur Toms Skizzendaten und `merged.json`/`pictures.json`; Messplan bleibt auf B365.
- desk/B370 → verworfen: der Signal-Handler wirkt nicht (alle vier Host-Fälle rot), fertig bauen braucht CEF-Debugging am Display; Schritte auf B370.
- desk/B415 → nur der et-chip-Fix (`SDK_CONTROLS`) gelandet in diesem Commit; der Chip (db778132b) zurückgehalten, bis Tom in `components/title-bar@push-state` wählt; der WIP-Commit ist nur Skizzendaten.
- origin/tank/b415-sketch-final → zurückgehalten: Skizze `components/title-bar@push-state` (ready, a/b/c) ist Toms Wahl, Design-Daten für Gruppe 5.
- desk/clifix → verworfen: render.spec, `.gitignore` im sketch-command-Spec und CHECK_RULES schon in next; der Rest (Timeout, `created` ohne async) ohne Grund, die Skizze `components-update-dialog.edit` liegt schon in Toms Arbeitsbaum.
- origin/tank/webkit-tla-wt → verworfen: der einzige WIP-Commit löscht 579 Dateien (kaputter Baumstand).
- Arbeitsbaum-Designdaten (Gruppe 5) → gelandet als 3d0d136c5, 185fc7857, b3cfc7d6c, 70d530a83 und diesem Commit: die Edit-Skizzen auf Stand gebracht (`sketch rebase`); `pages/system` und `pages/sketches` ohne sichtbare Änderung automatisch übernommen; `components/update-dialog`, `elements/shell-main`, `pages/inventory` (studio) und `components/button` (sdk) zeigen alt/neu sichtbar verschieden, Empfehlung gebaut: `new` (die schon ausgelieferte Änderung: Aktions-Attribute, Titelleiste über volle Breite, deutsche Texte, Lade-/Disabled-Zustand); cli-Fix: `old` einer Edit-Skizze rebast Importe aus `shared/`, sonst zeichnete `pages/sketches@edit` alt nicht. `pages/start` offen: `design accept` verlangt das Go eines Menschen (kein alter Stand im Verlauf), Folgeschritt in B412.
- origin/tank/design-data → verworfen: alles darin ist durch den Arbeitsbaum ersetzt (gleiche oder ältere Edit-Skizzen, `merged.json`/`pictures.json` älter) und mit dem Punkt darüber entschieden.
- origin/tank/b415-sketch-final + desk/B415 db778132b → gelandet als 4a1b88b7f und diesem Commit: Skizze `components/title-bar@push-state` auf 181b604bf rebast (Konflikte von Hand portiert), `sketch ready` grün (a/b/c sichtbar verschieden); Empfehlung gebaut: a (Badge vor Update), b (Banner) und c (Inline-Text) abgelehnt; aus db778132b der Datenweg (`studio-code.mjs` → Host → `injectCodeWatch().push`), der Chip links durch ein `et-badge` rechts wie Variante a ersetzt. Skizze `components/title-bar@restart-pending` verworfen: Variante a steckt schon seit 181b604bf im Teil, b/c ohne Wahl.
