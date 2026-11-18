---
name: cross-check
description: Brief for a fresh fable run that cross-checks one grill question before the human sees it (ADR 0358). Read when the doc agent has a recommendation that supersedes or amends an ADR or is hard to reverse.
---

# Cross-check a grill question

One fresh fable run per question (ADR 0358). There is no standing supervisor session.

## When

Only when the doc agent has a recommendation it would otherwise put to the human, and the choice supersedes or
amends an existing ADR or is hard to reverse (a move of many files, a deleted source of truth, a change to push or
release gates). A question of taste or priority (a look, the order of work, what to build) goes to the human
directly. A technical detail the doc agent may decide (a limit, a name, a threshold) it decides and notes in the ADR.

## Run

`Agent` with `model: "fable"`, in the foreground: the human approved fable for this use only. The run does not know
the day's course, so the brief carries everything it needs. Fill in and send:

```
Cross-check one grill question before the human sees it. Judge it; do not answer it.
Question: <as the human would read it>
Options: <one line each>
Recommendation: <the doc agent's pick and why>
ADRs: <from `yarn adr:governs <files>`, plus each ADR the choice supersedes or amends>
Claims: <each claim about code, git, a sketch or a tool, with its path or command>

Check:
- Facts: look each claim up (read the file, run the read-only command); name any you could not check.
- Already decided: search apps/ethlete-studio/docs/adr/ and docs/adr/ (title and body); name the ADR.
- Premise: does it rest on something untrue, or offer options that do not exist or do not work?
- Scope: one decision, and the human's? A look question belongs in a sketch; applying an existing
  decision to a new case is the doc agent's own.
- Wording: leading, wider than the case, or hiding a second decision? Is the recommendation backed?
- ADR draft: it quotes the human verbatim and adds nothing; name each addition.
Edit and commit nothing. Answer in English, one block: `ok`, `fix: <what> - <evidence>`, or
`drop: <ADR>`. Answer the question yourself only when the answer is a fact you checked or follows
from an ADR; say which.
```

## After

Apply the verdict. Leave one line in the ADR the question served: asked, the answer, and whether a question to the
human was saved.
