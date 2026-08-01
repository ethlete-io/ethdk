---
name: changeset
description: Create a changeset for a change to any @ethlete/* package (release notes + version bump). Use whenever you finish a code change to a publishable library (components, cdk, core, query, contentful, cli, types, eslint-plugin) and need to record it for release - e.g. the user says "add a changeset", or a PR needs one.
---

# Add a changeset

This repo releases with [changesets](https://github.com/changesets/changesets).
A changeset is a small markdown file in `.changeset/` that declares which
packages changed, at what semver level, and a human-readable note that becomes
the changelog / release-notes entry.

Write the file directly with the Write tool. **Do not run `npx changeset`** - the
CLI is interactive (it prompts for package selection and bump level) and will
hang in this environment.

## 1. Pick the packages

Every published package is named `@ethlete/<name>`:

| Package                  | Covers |
|--------------------------|--------|
| `@ethlete/components`    | Angular UI components (Tailwind-based), the newer overlay, menu, etc. |
| `@ethlete/cdk`           | Legacy/lower-level component toolkit |
| `@ethlete/core`          | Framework-agnostic primitives, directives, overlay runtime, signals utils |
| `@ethlete/query`         | Data fetching / query client |
| `@ethlete/contentful`    | Contentful integration |
| `@ethlete/cli`           | CLI tooling |
| `@ethlete/types`         | Shared TS types |
| `@ethlete/eslint-plugin` | Custom lint rules |

List **only** the packages whose source you actually changed. Story-only,
test-only, or `.claude/` changes don't need a changeset. If one logical change
spans several packages (e.g. a cross-cutting cleanup), list them all in one
changeset.

## 2. Pick the bump level

Follow semver, judged from the consumer's perspective:

- **patch** - bug fix or internal change; no new API, no breaking change. (Most common.)
- **minor** - new backwards-compatible API (new component, input, exported function, option).
- **major** - breaking change (removed/renamed export, changed signature or default behaviour consumers rely on).

When unsure between two levels, prefer the lower one for fixes and the higher
one for anything a consumer could notice. All listed packages usually share the
same level, but they can differ - give each its own line if so.

> Note: the workspace is currently in **prerelease mode** (`.changeset/pre.json`,
> tag `next`), so releases publish as `x.y.z-next.N`. This does not change how you
> author a changeset - still pick the real semver level as above.

## 3. Write the file

Path: `.changeset/<descriptive-kebab-name>.md`. Use a short, descriptive name
tied to the change (e.g. `overlay-routing-nested-header-footer.md`), not the
random `two-word-word.md` names the CLI generates.

Format - YAML frontmatter mapping each package to its bump level, then a blank
line, then the note:

```markdown
---
'@ethlete/components': patch
---

Overlay routing: one-sentence summary of what changed and why it matters to a
consumer. Add bullet points for multi-part changes:

- First notable change, phrased from the consumer's point of view.
- Second change.
```

Multiple packages:

```markdown
---
'@ethlete/components': minor
'@ethlete/core': patch
---

Summary of the cross-package change.
```

## Writing the note

### The length bar is hard, not aspirational

**A changeset note is a TL;DR: at most ~60 words, and never more than 4 lines of
prose.** Count them before you save. This limit does not scale with how much work
went in - a change that took a day and touched twenty files still gets one
sentence. Big features get *shorter* notes than you think, because the reader only
needs the entry point, not the tour.

If your note is longer than the frontmatter, you have written the wrong thing.
Delete it and write the one sentence a consumer needs to decide whether this
release affects them. Depth belongs in `apps/docs` (see the **`docs`** skill) -
the changelog links readers there by existing, not by duplicating it.

Cut on sight, no matter how interesting it was to work out:

| Never in a changeset | Where it goes instead |
| --- | --- |
| Why the bug happened, or what the first attempt was | the PR / commit body |
| How it works (mechanism, algorithm, CSS technique) | the guide in `apps/docs` |
| "Verified in Storybook", test counts, file paths | nowhere |
| A list of every input, token and attribute added | the guide's options table |
| Before/after comparisons, migration prose for unreleased API | nowhere |

### Bad vs good

Same change, both accurate - only one belongs in a changelog:

```markdown
<!-- BAD: explains the mechanism, lists every surface, reads like a guide -->
Slide transitions are a system rather than one effect: each slide carries a registered
`--et-carousel-slide-progress` running `-1` → `0` (centred) → `1`, filled either by a `view(inline)`
keyframe animation or - where scroll-driven animations don't exist yet - by a passive scroll listener
batched into a frame, selected by `transitionDriver`. Every effect is then pure CSS over one number:
`transition="dim"` and `transition="wipe"` (the Apple-TV-ish reveal), plus `data-transition` as the
hook for your own. `prefers-reduced-motion` turns the driver off…
```

```markdown
<!-- GOOD -->
Carousel: add scroll-driven slide transitions - `transition="dim"` / `"wipe"`, with `transitionDriver`
to pick what fills them.
```

### The rest

- Write for the changelog reader (a consumer of the library), not for reviewers
  of this PR. Say what the behaviour/API now does, not "fixed a bug in X".
- Lead with the area, e.g. `Overlay:`, `Grid:`, `Menu:`, when it helps scanning.
- Reference public API in backticks (`overlayRef.updatePositionStrategy(...)`).
- One sentence for simple changes. Add bullets only when several genuinely
  distinct things shipped - one line each, not a paragraph each. More than 4
  bullets means it should have been several changesets, or a shorter summary.
- A fix may name the symptom in a clause ("…it used to scroll out from under a
  paused drag") - that tells a reader whether they hit it. It may not explain the
  cause.

## Editing and consolidating unreleased changesets

A changeset is **unreleased** until its name appears in the `changesets` array of
`.changeset/pre.json`. Those unreleased `.md` files are safe to edit, rename,
merge, or delete - nothing has consumed them yet. Entries already listed in
`pre.json` are **locked** (already versioned/published in prerelease); never edit
or delete those files, and never hand-edit `pre.json` - dropping an entry
re-publishes its file with the wrong bump.

Find the unreleased ones by diffing the `.md` filenames against that array:

```bash
comm -23 \
  <(ls .changeset/*.md | xargs -n1 basename | grep -v '^README.md$' | sed 's/\.md$//' | sort) \
  <(python3 -c "import json;[print(c) for c in json.load(open('.changeset/pre.json'))['changesets']]" | sort)
```

When you touch these, actively keep them tidy - they are the next release's
changelog:

- **Consolidate overlaps.** If several unreleased changesets describe the same
  shipped feature or successive iterations of it (e.g. slices of one new
  component, or repeated fixes to the same area), merge them into one entry -
  fewer, coherent changelog lines beat a fragmented list. Keep genuinely distinct
  fixes as separate files.
- **Keep them concise.** Hold every unreleased note to the same hard bar as a
  fresh one (see **Writing the note**): ~60 words, 4 lines of prose, 4 bullets.
  An unreleased entry that has grown as a feature landed in stages is the most
  common place this slips - when you extend one, re-read the whole note and cut it
  back to a TL;DR rather than appending another paragraph.
- After merging/trimming, re-run the diff above (and `npx changeset status`) to
  confirm the frontmatter still parses and the set is what you expect.

## Verify

After writing, sanity-check the frontmatter parses: package names are quoted,
each has a valid level (`patch` | `minor` | `major`), and the file has the
`---` … `---` block followed by a blank line and the note.

## Companion: docs

A change that warrants a `minor` or `major` changeset (new/changed/removed
public API or behavior) almost always also needs a docs update in `apps/docs` -
see the **`docs`** skill. Patch-level internal fixes usually don't.
