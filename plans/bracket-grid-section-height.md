# Bracket grid: section height drops its own top padding

Investigated 2026-08-05, closing the last item in `opportunities.md`'s tech-debt
notes: `bracket-grid.ts`'s "the only unresolved-bug marker in the lib", a
`// TODO: The problem is here somewhere` above `subColumn.dimensions.top =
section.dimensions.top + sectionPaddingTop` in `calculateDimensions()`
(`libs/components/src/lib/bracket/drawing/grid/core/bracket-grid.ts`).

**That line is correct.** `section.dimensions.top` is assigned before
`runningTop` advances by the section's top padding, so adding `sectionPaddingTop`
back on lands exactly on the post-padding content start, in every branch
(`secIdx === 0` with/without a header, a section that overrides `padding`).

**The actual bug is 35 lines below it.** `runningTop` - and so the next
section's `top` - advances by `sectionPaddingTop + maxSectionHeight +
sectionPadding.bottom` (the padding-top add on line 66, the height+padding-bottom
add on line 116), but `section.dimensions.height` is stored as only
`maxSectionHeight + sectionPadding.bottom`, dropping the top padding. That
breaks the invariant `section.top + section.height === nextSection.top` (only
untested because `double-elimination-stacked.spec.ts` runs exclusively with
zero master-column padding, where the missing term is zero).

**Where it's reachable:** master-column `padding` is `{0,0,0,0}` everywhere in
the lib; the one place a *section* overrides padding is `swiss.ts`'s per-group
match-list section (`boxPadding` on all four sides, for the group border/spacing).
`section.dimensions` there flows straight into `bracket-finalizer.ts`'s
finalized column, which becomes `round.dimensions` on the `<ul class="et-bracket-round">`
in `bracket.component.html` - so each swiss group's round box is `boxPadding`
short. Currently invisible (`.et-bracket-round` has no border/background and
the visible group border in `draw-man-swiss.ts` is derived independently from
match extents, not from the section box), but wrong for any consumer that
measures or styles that box, and wrong as a stored value regardless.

**Fix:**

```diff
- section.dimensions.height = maxSectionHeight + sectionPadding.bottom;
+ section.dimensions.height = sectionPaddingTop + maxSectionHeight + sectionPadding.bottom;
```

No-op wherever padding is zero (every non-swiss layout, plus the swiss header/gap
sections), so no existing snapshot or invariant changes.

**Out of scope:** the same investigation surfaced two more spots that assume
zero section padding (`calculateSpannedWidth`/`calculateSpanStartLeft` ignore
`sectionPadding.left/right`; `bracket-gap-master-column.ts` doesn't copy
`section.padding` when mirroring). Both are dead today - swiss's padded
sections never span (`isStart && isEnd` on every swiss sub-column skips
`setupElementSpans` entirely) and the mirrored gap column's elements always
become `colGap`, which the finalizer drops. Not touching them: no reachable
bug, and "make padding correct everywhere" is a bigger, undirected change than
this fix.
