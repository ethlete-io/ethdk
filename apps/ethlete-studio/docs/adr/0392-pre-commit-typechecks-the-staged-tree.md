---
status: accepted
built: 64b875ca1
decided: 2026-11-20
amends: 0038, 0245
source: grill session 2026-11-20 (afternoon), after three broken Studio HEADs in one afternoon
---

# Pre-commit typechecks the staged tree

Twice in one afternoon a commit carried a hunk that used a file or label still uncommitted (de03dc510, 431bb2144),
so the human could not build Studio from HEAD while the builder's working tree was fine. A third commit (1de0d063b)
carried a type error that broke the design harness build.

Pre-commit typechecks the staged index tree, not the working tree, for each project whose `.ts` files the commit
touches. Measured by the builder: about 6.8 s `tsc --noEmit` warm plus 1-2 s to export the index tree, so 8-10 s per
commit. In return the typecheck leaves the pre-push suite, and the subagent brief line "a carried hunk must not
reference an uncommitted file or label" is deleted.

The human, asked whether to typecheck the staged tree at commit (moving the push typecheck there) or keep the brief
rule, with the recommendation "typecheck at commit": "ok".
