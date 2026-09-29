# components misc-b scan - open findings

Scan of `libs/components/src/lib/{scrollbar,toggletip,tooltip,picture,filter-overlay,floating-action,query-error,chip,kbd,progress-steps,banner,avatar,skeleton,internals,toolbar,timeline,badge,empty-state,description-list,card,divider,copy-button,focus-ring}` from 2026-09-28. 0 High, 0 Medium, 1 Low (10 fixed: tooltip description created once it has text 276135206 + 9644ff9de, card shadow token 7575a109e, avatar-group overflow label 587488011, copy-button announcement 3be0a39cb, progress-steps list b8f4cb056, query-error code label 30cd9d9c5, chip focus hand-off 517a82e5c, toolbar tabindex controls e51feb8d7, filter-overlay pending preview 7426975d4), 4 Spec. Skipped: specs, stories, testing drivers, most CSS beyond the layer/colour check.

## picture, avatar (image URL handling)

- Note: no security hole. Every URL is bound through `[src]`/`[attr.src]`/`[attr.srcset]` and goes through Angular's sanitizer. No `bypassSecurityTrust*` or `innerHTML` in scope.

## tooltip, toggletip

- Low: tooltip and toggletip CSS is ~120 lines each and mostly the same (`tooltip/tooltip.component.css`, `toggletip/toggletip.component.css`). Move the shared rules to the floating-panel styles. M The shadow colour reads `--et-shadow-color-rgb` since 7575a109e. The CSS merge is not decided.

## Spec gaps

- Spec: toolbar with an `<input>` inside, arrow keys and Home/End. S
- Spec: picture state after the parent passes new `sources` with the same URLs, and `withPictureBaseUrl` with `blob:` and `//` URLs. S
- Spec: floating-action with a scope or anchor that is destroyed. S
- Spec: no spec for progress-steps, banner or `internals/virtual-window.ts`. M
