---
status: accepted
built: 33ffa9d6b
decided: 2026-11-22
source: doc-agent session 2026-11-22 (afternoon), B662
---

# The tomflix test run designs only with the human

The builder prepared the clean-slate tomflix run of ADR 0399: a copy with the data layer only, a sandbox with no network
path to the Studio design, the SDK design files or the old tomflix calls. The human (German, verbatim): "das setup
vorbereiten ist okay aber nicht ohne mich mit dem designen anfangen".

- Agents may prepare and check the setup alone. The design stage of the run starts only with the human present.
- The sandbox gets a fresh copy of the human's Claude sign-in at start and deletes it on exit. The human found this
  question "zu technisch": such sandbox internals are builder defaults, not grill questions.
