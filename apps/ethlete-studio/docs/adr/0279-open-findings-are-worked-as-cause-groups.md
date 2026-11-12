---
status: accepted
open: B499
decided: 2026-11-12
source: chat with the doc agent 2026-11-12 (morning); grouping by the analysis session claude2
---

# Open findings are worked as cause groups

An analysis session measured that about 90 of 155 findings since 800 were opened while another finding was fixed, so
the loop is finding, fix, new finding. It sorted the 227 open findings (415-997) into cause groups. The doc agent asked:
lead the groups in STATUS.md as rebuild rows instead of single findings, in the order R2 + R3, R1, R5, R4, R6, the CLI
batch, the single product defects; the 92 machinery findings are touched only when CI is red; the builders work groups,
not single numbers. The human answered "ok".

- Each cause group is one STATUS row (B498-B504). A builder takes the oldest open group row, not a single finding.
- Order: B498 (R2 + R3), B499 (R1), B500 (R5), B501 (R4), B502 (R6), B503 (CLI batch), B504 (single product defects).
- The machinery findings (sessions, handoffs, bookkeeping, flaky specs, push gates, temp files, machines that disturb
  each other) stay parked as a whole; a builder touches one only when CI is red.
- Not decided by this ADR: whether a follow-up defect of a fix gets a new number, and whether a group row closes only
  when all its findings are closed.
