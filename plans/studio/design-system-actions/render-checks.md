# Open: 4. Render checks and shots

### 4.7 Fitted `vh` parts have no true height - known limit

- The frame settles about 32 px taller; live and shot heights can differ.

### 4.54 Utility CSS in parts - open rest

The motion declaration is decided (ADR 0133, 0134, 0363). Left of the move to Tailwind utilities in the Studio parts:
`inbox`, `comment-pin`, `pages/sketches` and `foundations/agent-logos` after their open sketches merge,
`shell-main/shared/picker.css`; `.st-disclosure-body` stays because `pages/merge/merge-data.ts` builds its own
`<ul class="st-disclosure-body">`. Then register `UTILITY-CSS` in `RULES`.
