---
status: accepted
open: B664
decided: 2026-11-22
source: doc-agent session 2026-11-22 (afternoon)
---

# A builder may wake rack for a Windows batch

ADR 0273 ruled out Wake-on-LAN for the guest PC `rack`, because the human could not reach its BIOS. On 2026-11-22 the
doc agent woke `rack` with `sh spiele-pc.sh an rack` in `~/umbau-elrond/elrond/spiele-pcs/`: the status showed it on
within a minute. The human (German, verbatim): "q3 wol geht".

This amends ADR 0273. Windows work is still collected and done in one batch. For that batch a builder wakes `rack`
itself; it does not ask the human to switch it on. A builder does not shut `rack` down while another session (for
example the fifagg e2e) uses it.
