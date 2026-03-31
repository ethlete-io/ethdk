---
name: code-review
description: Automated code review for styleguide compliance
---

# Skill Instructions

- For each file to check:
  - Apply all rules from `.agents/instructions/styleguide.instructions.md`.
  - Only consult `docs/STYLEGUIDE.md` if a rule is unclear or missing.
  - If types or symbols are unclear, read imported files as needed.
- Summarize all violations and suggestions clearly, referencing line numbers and rule sections. Do not report passed checks.
- If no violations are found, state that the file(s) fully comply.
- Do not attempt to auto-fix code; this skill is for review only.
