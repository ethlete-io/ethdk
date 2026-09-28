# components misc-b scan - open findings

Scan of `libs/components/src/lib/{scrollbar,toggletip,tooltip,picture,filter-overlay,floating-action,query-error,chip,kbd,progress-steps,banner,avatar,skeleton,internals,toolbar,timeline,badge,empty-state,description-list,card,divider,copy-button,focus-ring}` from 2026-09-28. 0 High, 1 Medium, 9 Low, 4 Spec. Skipped: specs, stories, testing drivers, most CSS beyond the layer/colour check.

## picture, avatar (image URL handling)

- Low: the `+N` overflow avatar has no accessible label, so a screen reader reads "+3" with no context (`avatar/avatar-group.component.ts:34`). Add a label ("3 more") to the avatar labels. S
- Note: no security hole. Every URL is bound through `[src]`/`[attr.src]`/`[attr.srcset]` and goes through Angular's sanitizer. No `bypassSecurityTrust*` or `innerHTML` in scope.

## tooltip, toggletip

- Medium: every `etTooltip` instance appends a hidden description `<div>` to `document.body` at construction, even if it never shows (`tooltip/headless/tooltip.directive.ts`). A table with 1000 tooltip cells adds 1000 body nodes. The SSR duplicate is fixed (no node on the server); the node count is open: lazy creation on focus/hover would drop the description in screen-reader browse mode, and `aria-description` is ignored whenever the consumer sets `aria-describedby`, so it needs a decision. M
- Low: tooltip and toggletip CSS is ~120 lines each and mostly the same (`tooltip/tooltip.component.css`, `toggletip/toggletip.component.css`). Both also hardcode the shadow colour `rgb(0 0 0 / 0.16)` (`tooltip.component.css:54`, `toggletip.component.css:47`). Move the shared rules to the floating-panel styles. M

## toolbar

- Low: `CONTROL_SELECTOR` misses `[tabindex]` elements (`toolbar/headless/toolbar.directive.ts:6`). The toolbar itself writes `tabindex="-1"` on its controls, so `[tabindex]` either takes in every consumer `tabindex="-1"` element or needs an ownership mark to stay stable across syncs. S

## progress-steps, banner

- Low: `et-progress-steps` has no list semantics (`progress-steps/progress-steps.component.ts:27`), unlike `et-timeline`, which sets `role="list"`. S

## query-error, filter-overlay

- Low: `(Code: ${status})` is hardcoded outside the labels (`query-error/headless/query-error.directive.ts:89`). A German label set still gets English punctuation and "Code". Move it into `labels.message`. S
- Low: the preview counts the debounced `draft.value` (`filter-overlay/filter-overlay.ts:119`), but `submit` applies `draft.liveValue()` (`:145`). During a pending debounce the button shows the count for the old value. S

## chip, copy-button, card

- Low: `focusSuccessors` stays set when the consumer does not remove the chip after `remove` (for example a cancelled confirm). A later destroy then moves focus to a sibling (`chip/headless/chip.directive.ts:103,49-53`). Clear it after the next render. S
- Low: `copied()` changes only the icon. Nothing announces "Copied" to a screen reader (`copy-button/copy-button.directive.ts`). S
- Low: hardcoded shadow colour `rgb(0 0 0 / 0.12)` (`card/card.component.css:36`). S

## Spec gaps

- Spec: toolbar with an `<input>` inside, arrow keys and Home/End. S
- Spec: picture state after the parent passes new `sources` with the same URLs, and `withPictureBaseUrl` with `blob:` and `//` URLs. S
- Spec: floating-action with a scope or anchor that is destroyed. S
- Spec: no spec for progress-steps, banner or `internals/virtual-window.ts`. M
