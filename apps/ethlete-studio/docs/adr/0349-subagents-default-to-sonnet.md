---
status: accepted
built: b28dc044d
decided: 2026-11-18
source: process review of the analysis session (ethlete-sdk-3f) 2026-11-18, its proposal approved by the human with "ok" ("1, 2 und 4 sofort, 3 und 5 danach" was the proposal), relayed through the doc agent
---

# Subagents default to sonnet

547 of 730 subagent spawns in eight days ran on opus, and subagents used about 55 % of the tokens. From now on a
subagent runs on sonnet unless the task is one the model table in AGENTS.md names for opus (a bug with no known cause, a
change across many files, a review of a diff, a task sonnet did not finish). Each brief names the files and line ranges,
so the subagent does not search for them. The `subagent-model-policy.py` hook carries the default.
