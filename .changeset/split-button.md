---
'@ethlete/components': minor
---

Button: new split button. `<et-split-button>` groups an action segment (`etSplitButtonAction`) and a trigger segment (`etSplitButtonTrigger`) — both regular surface/icon buttons — into one `role="group"` control with joined corners and a divider between the segments.

- The segments keep the full button API (variant, size, color, disabled, loading); the trigger typically also carries `etMenuTrigger` to open a menu with related actions.
- The divider color is themeable via `--et-split-button-divider-color` (defaults to `currentColor` at 32%).
- The headless `SplitButtonDirective` (`[etSplitButton]`) plus the segment directives are exported for custom-styled split buttons.
- Missing or misplaced segments throw dev-mode errors in the new `ET23xx` range.
