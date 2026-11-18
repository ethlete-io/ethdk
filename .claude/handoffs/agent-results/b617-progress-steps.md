# B617 Progress-Steps-Tokens

New tokens (progress-step.component.css, defaults keep today's look):
- `--et-progress-step-connector-width` (2px), `-connector-color` (surface border), `-connector-complete-color` (theme ink); connector offsets derive from the width, horizontal and vertical.
- Current marker (opt-in; exact shape was unclear, generic version): `-current-marker-background`, `-current-dot-size` (0px = no dot), `-current-dot-color`, `-current-marker-content` (set `''` to hide the number).
- `-label-upcoming-font-weight` (inherit), `-label-done-font-weight` (600 for success/warning/error as before, inherit for complete).
- `-description-line-height` (inherit).

Docs: token table plus filled-dot example in apps/docs/components/progress-steps.md. Changeset: .changeset/progress-steps-tokens.md (minor).
Verified: lint components --fix, prettier, vitest related (128 files pass), new token spec cases.
Not verified: Storybook look (not running on :4400); ADR 0248 not separately read (no state logic changed); adr:governs printed nothing.
