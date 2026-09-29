# components misc-b scan - open findings

Scan of `libs/components/src/lib/{scrollbar,toggletip,tooltip,picture,filter-overlay,floating-action,query-error,chip,kbd,progress-steps,banner,avatar,skeleton,internals,toolbar,timeline,badge,empty-state,description-list,card,divider,copy-button,focus-ring}` from 2026-09-28. 0 High, 0 Medium, 1 Low (10 fixed: tooltip description created once it has text 276135206 + 9644ff9de, card shadow token 7575a109e, avatar-group overflow label 587488011, copy-button announcement 3be0a39cb, progress-steps list b8f4cb056, query-error code label 30cd9d9c5, chip focus hand-off 517a82e5c, toolbar tabindex controls e51feb8d7, filter-overlay pending preview 7426975d4), 0 Spec (4 closed 2026-09-29: toolbar input, picture sources and base URL, progress-steps, banner and virtual-window already had specs; floating-action anchor destroy added). Skipped: specs, stories, testing drivers, most CSS beyond the layer/colour check.

## picture, avatar (image URL handling)

- Note: no security hole. Every URL is bound through `[src]`/`[attr.src]`/`[attr.srcset]` and goes through Angular's sanitizer. No `bypassSecurityTrust*` or `innerHTML` in scope.

## tooltip, toggletip

- Low: tooltip and toggletip CSS is ~120 lines each and mostly the same (`tooltip/tooltip.component.css`, `toggletip/toggletip.component.css`). Move the shared rules to the floating-panel styles. M The shadow colour reads `--et-shadow-color-rgb` since 7575a109e. The CSS merge is not decided.
