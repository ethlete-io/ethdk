---
status: accepted
built: 8f059ae72
decided: 2026-11-05
source: grill session 2026-11-05
---

# B372 comes before the push

The CI run 41924354824 cannot turn green before B372. Its Studio rules job now builds the mocks and runs `design check`,
and the check fails on the 3 real problems of finding 438, which B372 fixes. The builder therefore builds B372 now. The
four local CI fixes (f30bb3b81, b770d4222, 66a4de23f, 4de41ac2e) and the other unpushed commits go out with it, then
B377 follows. This replaces the order "CI green, push, B377, B372" of ADR 0192. Tom: "q1ok".
