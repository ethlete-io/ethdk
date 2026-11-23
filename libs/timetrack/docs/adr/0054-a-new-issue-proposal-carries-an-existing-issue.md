---
built: f1c6ae311
decided: 2026-11-19
---

# A new issue proposal carries an existing issue

During a long refactor auto mode proposed several new Jira issues ("Visuelle Baselines ...", "Offene Punkte ...
übergeben") for work that existing issues already cover. Asked whether auto mode should stop proposing new issues, the
human answered: "ne das ist doof. ich finde das schon gut wenn er neue issues vorschlägt. aber aktuell mache ich halt
einen refactore marathon. das ist natülrich eine edge case", and then: "es wäre schon nett wenn timetrack das auch
merkt. der kram muss ja trozde,m zugewiesen werden wenns passiert während ich arbeite". The rule below was confirmed
with "ok".

- Auto mode keeps proposing new issues.
- Every new issue proposal carries the best-fitting existing issue as an alternative in the same chip. One press books
  the band there instead.
- When the same branch already books onto an existing issue that day (the same work running on), auto mode turns the
  order around: the existing issue is the proposal, the new issue the alternative.
- A rejected or expired new issue does not book the band by itself. The band keeps the existing issue as its proposal.
