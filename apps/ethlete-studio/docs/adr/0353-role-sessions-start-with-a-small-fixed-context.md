---
status: accepted
built: d2d8aeb7a
decided: 2026-11-18
source: process review of the analysis session (ethlete-sdk-3f) 2026-11-18, Package E, its proposal approved by the human with "ja wir machen alles was sinn gerbt", relayed through the doc agent
---

# Role sessions start with a small fixed context

Every role session starts with about 43k fixed tokens (system tools 20.9k, skills 8.3k, memory files 8.3k, MCP
instructions 3.1k, system prompt 2.8k); the builder is at 61k at turn 1. A headless run in this repo measured 40772
tokens as baseline, 34083 without the claude.ai connectors, 35537 with seven unused tools denied, and 20174 with all
cuts. The analysis session proposed the points below; the human answered "ja wir machen alles was sinn gerbt". The
points are the analysis session's text, approved by the human.

1. Launch the role sessions without the claude.ai connectors, only with the repo's ethlete-design server, in the
   agent-sessions `run`/`restart` path. Verify the design MCP still connects.
2. Deny the tools a role never uses, per role and at launch, not in `.claude/settings.json` (that would hit the human's
   own sessions). Check each role's transcripts for use before denying a tool.
3. Shorten the long descriptions of repo skills, and switch off the synced claude.ai skills for role sessions.
4. Trim AGENTS.md by what the process review found wrong or duplicate.
5. Split the handoff skill so that a resume loads only the resume part.

Each point is done when the headless measurement is repeated with the new launch and its number is in the commit.

The second half of point 3 (switch off the synced claude.ai skills) is dropped: Claude Code has no switch for it
(builder, 2026-11-18). A row follows only if one appears.
