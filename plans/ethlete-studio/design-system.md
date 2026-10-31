# Ethlete Studio - the design system model

Status (2026-10-27): slices 1 and 2 done; the old Calls UI is removed. Slice 4: core, Studio sketch view, frame sizes and the sketch matrix done. Slice 5: core and Studio comments done, with threads. States and interactions: done (steps 1 to 6). Slice 6: done, with slice C (numbered note markers, hover line, note size; 2c6878d4e, c2ea12698) and the note format in the exploration skill (806aa94d9, 848f76d15). Slice 10: step 1 (sdk base, studio product, tokens import) done; the redesign runs layer by layer: foundations merged: surfaces, accent, type, spacing (see "Slice 10 foundations, as built"); Studio reads the merged tokens (9ed3560f4); component layer: SDK tokens mapped and app classes swapped (see "Component layer: SDK tokens mapped, as built"); the component list comes from the Studio wireframes. Slice 3 inventory done; the rebuild follows slice 10, as in "Slice 10 decisions". Open items per slice are at the end of this file.

This plan replaces the call model (project → feature → call → variant, the 1-7 workflow, call
stages and `legacy: true`). The bridge from the design system to the app code is out of scope. Decide it when
a real system exists.

Importing existing frontend code into independent Studio designs is a separate planned
direction: [Existing code import](existing-code-import.md). It preserves the separation
between design and production code; later design-to-frontend translation remains separate.

## Open points

- [Sketch canvas zoom controls — open](design-system/self-test-open.md)
- [Sketch render check blocked by sandbox port — open](design-system/self-test-open.md)
- [Sketch camera prototype duplicates app behavior — open](design-system/self-test-open.md)
- [Sketch camera fit leaves a blank band — proposed correction, review pe](design-system/self-test-open.md)
- [Sketch variant header density — proposed correction, review pending](design-system/self-test-open.md)
- [Fixed sketch heads drift from camera columns — proposed correction, re](design-system/self-test-open.md)
- [Context crops contradict the shared zoom model — proposed correction, ](design-system/self-test-open.md)
- [Studio WebKit UI hangs during page exploration — open bug (2026-10-28)](design-system/self-test-open.md)
- [Studio page sketches use CSS while the app uses Tailwind — open workfl](design-system/self-test-open.md)
- [Round e accepted; zoom composition remains open (2026-10-28)](design-system/self-test-open.md)

## Topic files

- [model](design-system/model.md): Why, the model, roles, structure, layers, files, slice 1 decisions, SDK-first, parallel work
- [rules](design-system/rules.md): Sketches, feedback, checks, canvas rules, kept call model, legacy calls, the slice list
- [decisions-core](design-system/decisions-core.md): Slice 2/4-8/10, tokens, foundations, theming, wireframe kit, states, checkup, Docs
- [decisions-sketches](design-system/decisions-sketches.md): Picker, sketch view and API, sketch matrix, canvas
- [decisions-frames](design-system/decisions-frames.md): Frame size, frame reload (files, Studio), merge and rebase, merge preview, sketch rounds
- [decisions-wireframes](design-system/decisions-wireframes.md): Wireframes first and round 1, flow and note layout, wireframe kit fixes and follow-ups
- [decisions-comments](design-system/decisions-comments.md): Comment UI, threads, notes, flow comments, agent authors, answered threads
- [self-test-open](design-system/self-test-open.md): Studio self-test roadblocks that are open, proposed or pending review

## Archive (finished history, not live)

- [design-system/self-test-findings](archive/design-system/self-test-findings.md): Self-test findings reproduced, confirmed, rejected or corrected
- [design-system/as-built-core](archive/design-system/as-built-core.md): As-built: server, canvas, system view, foundations, tokens, logo, component layer
- [design-system/as-built-sketches](archive/design-system/as-built-sketches.md): As-built: sketch API, Studio sketch view, sketch matrix
- [design-system/as-built-frames](archive/design-system/as-built-frames.md): As-built: frame sizes, frame reload, merge preview, sketch rounds, Studio reload
- [design-system/as-built-comments](archive/design-system/as-built-comments.md): As-built: comments, threads, agent authors, answered threads, comment cleanup
