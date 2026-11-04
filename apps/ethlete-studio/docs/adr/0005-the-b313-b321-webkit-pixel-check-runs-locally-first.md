---
status: accepted
open: B321
decided: 2026-11-04
source: plans/ethlete-studio/backlog-parallel/decisions-latest.md, "Pixel check and blocker wording" (findings 374, 375) item 1
---

# The B313/B321 WebKit pixel check runs locally first

An agent writes the WebKit pixel check (explorer pixels under frame churn plus a 1.5-3 s main-thread busy loop,
ScreenCaptureKit capture) without running it. Tom names a quiet window and grants Screen Recording; it then runs once
on HEAD (must fail) and once with the shell-main stacking fix (must pass). A macOS CI job is a follow-up.
