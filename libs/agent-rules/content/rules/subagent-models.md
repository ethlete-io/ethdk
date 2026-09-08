---
name: subagent-models
description: A subagent's model is an explicit choice on every call - haiku for lookups, opus for work, fable for judgment.
kind: rule
scope: both
---

## Delegating: name the subagent's model

A subagent spawned without a `model` runs on the model leading the session, so an expensive
model ends up doing every small job it delegates. **Set `model` on every call**, matched to the
task:

| Model    | The work it fits                                                                                                                                         |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `haiku`  | Mechanical lookups: grep, find, read a file, run a command and report what it said.                                                                      |
| `sonnet` | A middle ground where opus is more than the task needs.                                                                                                  |
| `opus`   | The default for real work: code changes, tests, debugging, reviewing a diff.                                                                             |
| `fable`  | Judgment-heavy work: planning, design, cross-cutting review, leading other subagents. The most expensive of the four, so ask the user before picking it. |

Effort follows the prompt, not a parameter: scope the prompt to one question, name what "done"
means, and say "keep it brief" for a lookup. Two calls need no `model` of their own - a named
agent type carries the model and reasoning effort its own definition sets, and a fork always
inherits the parent's model.
