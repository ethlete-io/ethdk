---
name: changeset
description: Create a changeset for a change to any @ethlete/* package (release notes + version bump). Use whenever you finish a code change to a publishable library (components, cdk, core, query, contentful, cli, types, eslint-plugin) and need to record it for release - e.g. the user says "add a changeset", or a PR needs one.
---

# Add a changeset

> **The note is one sentence. Two at most. Never a third.**
> Under 40 words, no paragraphs, no "how it works", no API inventory. If it is
> longer than the frontmatter above it, you have written the wrong thing - delete
> it and write the TL;DR. This holds no matter how much work the change took.

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

Overlay routing: one-sentence summary of what a consumer now gets.
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

### The shape: one sentence

**One sentence. Two at most. Under 40 words. No second paragraph, ever.**

This is not a summary of your work - it is the line a consumer skims to decide
whether this release affects them. It does not scale with effort: a change that
took a day and touched thirty files still gets one sentence. Big features get
*shorter* notes than small fixes, because the reader only needs the entry point.

Depth belongs in `apps/docs` (see the **`docs`** skill). The changelog serves
readers by being short enough to read, not by duplicating the guide.

**Bullets are the exception, not the format.** Use them only when two or three
genuinely unrelated things shipped under one package bump - one short line each,
never a paragraph each. Three bullets is the ceiling; more means it should have
been several changesets. If you can join them with "and", write one sentence.

### Cut on sight

No matter how interesting it was to work out:

| Never in a changeset | Where it goes instead |
| --- | --- |
| Why the bug happened, or what the first attempt was | the PR / commit body |
| How it works (mechanism, algorithm, CSS technique, what reads what) | the guide in `apps/docs` |
| An inventory of every new input, token, option, attribute or export | the guide's options table |
| Internal API churn (renamed private helper, changed `subtle` shape) | nowhere |
| "Verified in Storybook", test counts, file paths | nowhere |
| Before/after comparisons, migration prose for unreleased API | nowhere |
| Caveats and warnings you want the reader to know | the guide |

The tell: any sentence starting with "The", "Each", "Routes", "Options" that
*explains* rather than *announces* is guide prose. Delete it.

### Bad vs good

Same changes, all accurate - only the short ones belong in a changelog.

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

```markdown
<!-- BAD: opens with the TL;DR, then can't stop - four more paragraphs of mechanism,
     API inventory and caveats that all belong in the guide -->
Query devtools: show the path params a query actually used, and export requests to Insomnia.

Routes built from a function are now listed with their params filled in from the query's args
(`/post/12` instead of `/post/:param`), each param highlighted and the request's query string
dimmed behind the path, so several rows hitting the same endpoint are tellable apart.
Placeholders carry the real param name because the registry records it off the route function…
New **Insomnia** actions copy the selected query… `Authorization` included, so treat the export
as sensitive. `HttpRequest` gains `args` and `subtle.resolveHeaders()`. The internal
`stringifyQueryRoute()` is replaced by `parseQueryRoute()` + `stringifyQueryRouteParts()`.
```

```markdown
<!-- GOOD: the first line was already the whole changeset -->
Query devtools: show the path params a query actually used, and export requests to Insomnia.
```

### The rest

- Write for the changelog reader (a consumer of the library), not for reviewers
  of this PR. Say what the behaviour/API now does, not "fixed a bug in X".
- Lead with the area, e.g. `Overlay:`, `Grid:`, `Menu:`, when it helps scanning.
- Reference public API in backticks (`overlayRef.updatePositionStrategy(...)`).
- A fix may name the symptom in a clause ("…it used to scroll out from under a
  paused drag") - that tells a reader whether they hit it. It may not explain the
  cause.

### Before you save

Re-read the note and count. More than two sentences, or more than three bullets,
means delete and rewrite - not trim. Then check every remaining clause answers
"what do I now get?" rather than "how does it work?".

### The bar is enforced, not advisory

`yarn lint:changesets` fails on any unreleased changeset over **40 words**, with more
than **one paragraph**, more than **three bullets**, or with frontmatter that names an
unknown package or bump level. It runs in three places: a `PostToolUse` hook checks the
single file the moment you write it, `.husky/pre-commit` checks the staged ones, and CI
checks every unreleased one - so an over-long note comes straight back at you.

When it fires, **delete the note and write the one-sentence version**. Do not shave
words off the paragraphs you have until the count passes: a 40-word note that is a
compressed guide is still the wrong thing. Only entries already listed in
`.changeset/pre.json` are exempt, and only because they are locked.

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
  fresh one: one to two sentences, under 40 words. An entry that grew as a feature
  landed in stages is where this slips most - when you extend one, rewrite the
  whole note as a single sentence covering the feature. Never append a paragraph.
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
