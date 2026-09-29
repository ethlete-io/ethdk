# components misc-b scan - open findings

Scan of `libs/components/src/lib/{scrollbar,toggletip,tooltip,picture,filter-overlay,floating-action,query-error,chip,kbd,progress-steps,banner,avatar,skeleton,internals,toolbar,timeline,badge,empty-state,description-list,card,divider,copy-button,focus-ring}` from 2026-09-28. 0 High, 1 Medium, 3 Low (6 fixed: avatar-group overflow label 587488011, copy-button announcement 3be0a39cb, progress-steps list b8f4cb056, query-error code label 30cd9d9c5, chip focus hand-off 517a82e5c, toolbar tabindex controls e51feb8d7), 4 Spec. Skipped: specs, stories, testing drivers, most CSS beyond the layer/colour check.

## picture, avatar (image URL handling)

- Note: no security hole. Every URL is bound through `[src]`/`[attr.src]`/`[attr.srcset]` and goes through Angular's sanitizer. No `bypassSecurityTrust*` or `innerHTML` in scope.

## tooltip, toggletip

- Medium: every `etTooltip` instance appends a hidden description `<div>` to `document.body` at construction, even if it never shows (`tooltip/headless/tooltip.directive.ts`). A table with 1000 tooltip cells adds 1000 body nodes. The SSR duplicate is fixed (no node on the server); the node count is open: lazy creation on focus/hover would drop the description in screen-reader browse mode, and `aria-description` is ignored whenever the consumer sets `aria-describedby`, so it needs a decision. M
- Low: tooltip and toggletip CSS is ~120 lines each and mostly the same (`tooltip/tooltip.component.css`, `toggletip/toggletip.component.css`). Both also hardcode the shadow colour `rgb(0 0 0 / 0.16)` (`tooltip.component.css:54`, `toggletip.component.css:47`). Move the shared rules to the floating-panel styles. M

## query-error, filter-overlay

- Low: the preview counts the debounced `draft.value` (`filter-overlay/filter-overlay.ts:119`), but `submit` applies `draft.liveValue()` (`:145`). During a pending debounce the button shows the count for the old value. S

## chip, copy-button, card

- Low: hardcoded shadow colour `rgb(0 0 0 / 0.12)` (`card/card.component.css:36`). S

## Spec gaps

- Spec: toolbar with an `<input>` inside, arrow keys and Home/End. S
- Spec: picture state after the parent passes new `sources` with the same URLs, and `withPictureBaseUrl` with `blob:` and `//` URLs. S
- Spec: floating-action with a scope or anchor that is destroyed. S
- Spec: no spec for progress-steps, banner or `internals/virtual-window.ts`. M
