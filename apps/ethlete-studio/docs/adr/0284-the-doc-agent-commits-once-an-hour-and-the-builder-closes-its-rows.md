---
status: accepted
built: d326560de
decided: 2026-11-12
source: chat with the doc agent 2026-11-12 (late morning), proposal of the analysis session
---

# The doc agent commits once an hour, and the builder closes its rows

The analysis session measured 7-18 docs-only commits per hour at night and 55 % plan/ADR/changeset-only commits over
ten days; each one makes the builders fetch again before a push. The human answered (German, verbatim):

> Q1 – Ja, auch zu seiner Abweichung […] Die Log-Datei bleibt außerhalb von Git (zum Beispiel unter .claude/handoffs/)
> und wird bei jeder Übertragung geleert. Sie bekommt kein Archiv, kein Skript und keine Prüfung. Übertragen heißt
> zusammenfassen. Zehn Notizen zu einer Gruppe werden eine Zeile in STATUS.md, nicht zehn.
>
> Q2 – Ja. Ein ADR hält deine Entscheidung fest. Dass etwas gebaut wurde, steht in Git.
>
> Q3 – Ja, mit einem Hinweis. Die Notiz gehört in den Commit des Builders. Das gilt aber erst für Builder, die mit dem
> neuen Skill-Text laufen. […] Bis dahin muss der Doc-Agent einzelne Zeilen weiter selbst schließen.
>
> Die Zeile „jede Entscheidung sofort an den Builder" ist nicht doppelt. […] das Senden in die neue Zeile aufnehmen:
> „Eine Entscheidung, die der Builder jetzt braucht, checke ich sofort ein und schicke sie ihm als Nachricht."

- The doc agent collects notes, group lines and closed rows in one file outside git, never open in `STATUS.md` (the
  builder shares the working tree and would commit them). Once an hour and at shift end it folds them into
  `STATUS.md`, commits, and empties the file.
- At once: a decision the builder needs now (committed and sent), and a row a commit must close.
- That a row was built gets no ADR and no note. The builder closes its row and writes the "as built" note in its slice
  commit; until both builders run on the new skill text, the doc agent closes rows itself.
