---
open: B616
decided: 2026-11-18
amends: 0041
---

# Paired machines show the same day

Findings #24 and #25 (`plans/timetrack/findings-2026-11-17-demo-prep.md`): a manual row made on tank was a gap on the
Mac, and work done from the Mac over SSH on tank did not show on the Mac at all. Until now only events travelled
(ADR 0039); row edits, manual rows, rules and stand-ins stayed on the machine that made them (ADR 0041 pt 5).

The human, 2026-11-18 (German, verbatim): "wir müssen schon timetrack instanzen in sync halten wenn sie gekoppelt sind.
wenn 2 instanzen unterschiedliche dinge zeigen ist es schwachsinn" and "wenn ich per ssh arbeite von mac auf tank will
ich natülrich auf meiner timetrack mac instanz das reflektiert sehen".

1. Paired machines show the same day. Everything that shapes a day travels: manual rows, row edits (rename, cut,
   merge), rules and stand-ins. This replaces "settings and stand-ins stay on the booking machine" in ADR 0041 pt 5.
2. Credentials and machine paths never travel; a path reaches a peer only through the stream key map (ADR 0039).
3. Two machines that edit the same row: the later edit wins, by the skew-corrected clock of ADR 0041 pt 2.
4. Booking is unchanged: the machine you book from owns the day (ADR 0041 pt 1).
5. Work over SSH: the machine you work on collects (Timetrack runs there and starts with the session), the machine you
   sit at shows the same rows and can book them. Done when a real day of SSH work from the Mac on tank shows on the
   Mac as the same rows tank shows.

Points 1-3 and 5 are technical choices of the doc agent under the human's decision.
