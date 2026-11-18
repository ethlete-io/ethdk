---
status: accepted
built: 9a09543c8
decided: 2026-11-18
source: chat of the human with the analysis session (ethlete-sdk-3f) 2026-11-18, its proposal approved by the human, relayed by the analysis session; supersedes ADR 0287
---

# A cross-check is a fresh fable run, for some questions only

The human said about the supervisor (German, verbatim):

> meinte den supervisor. der läuft auf fable ergo besser as opus im doc agent. fand das eig ganz brauchbar zu
> crosschecks bei fragen. er bekommt so aber halt ggf selten fragen / muss den kontext aus kaltem cache neu aufbauen
> etc...

The analysis session proposed a fresh run per question instead of a standing session. The human answered (verbatim):

> mhm ja aber nicht für jede frage. sonst wirds teuer denke ich

1. No standing supervisor session for cross-checks. The doc agent starts a fresh fable run per question with a narrow
   brief: the question, the options, its recommendation, and the ADRs it touches (from `yarn adr:governs`). The fresh
   run does not know the day's course, so the brief names what it needs. This is the human's approval of fable for
   this use only.
2. Not for every question. The analysis session narrowed "nicht für jede frage" to these triggers; the human has not
   seen this list, so it is the doc agent applying his limit, not his ruling:
   - Cross-check only when the doc agent has a recommendation it would otherwise put to the human, and the choice
     supersedes or amends an existing ADR or is hard to reverse (a move of many files, a deleted source of truth, a
     change to push or release gates).
   - No cross-check for a question of taste or priority (the look of a design, the order of work, what to build): it
     goes to the human directly.
   - No cross-check for a technical detail the doc agent may decide itself (a limit, a name, a threshold): it decides
     and notes it in the ADR.
   - Each cross-check leaves one line in the ADR it served: asked, the answer, and whether a question to the human was
     saved. The re-measurement in about a week counts them.

It supersedes ADR 0287 (the doc agent sends its questions to the supervisor, the analysis session).
