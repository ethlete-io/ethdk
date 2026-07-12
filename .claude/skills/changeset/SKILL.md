---
name: changeset
description: Create a changeset for a change to any @ethlete/* package (release notes + version bump). Use whenever you finish a code change to a publishable library (components, cdk, core, query, contentful, cli, types, eslint-plugin) and need to record it for release — e.g. the user says "add a changeset", or a PR needs one.
---

# Add a changeset

This repo releases with [changesets](https://github.com/changesets/changesets).
A changeset is a small markdown file in `.changeset/` that declares which
packages changed, at what semver level, and a human-readable note that becomes
the changelog / release-notes entry.

Write the file directly with the Write tool. **Do not run `npx changeset`** — the
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

- **patch** — bug fix or internal change; no new API, no breaking change. (Most common.)
- **minor** — new backwards-compatible API (new component, input, exported function, option).
- **major** — breaking change (removed/renamed export, changed signature or default behaviour consumers rely on).

When unsure between two levels, prefer the lower one for fixes and the higher
one for anything a consumer could notice. All listed packages usually share the
same level, but they can differ — give each its own line if so.

> Note: the workspace is currently in **prerelease mode** (`.changeset/pre.json`,
> tag `next`), so releases publish as `x.y.z-next.N`. This does not change how you
> author a changeset — still pick the real semver level as above.

## 3. Write the file

Path: `.changeset/<descriptive-kebab-name>.md`. Use a short, descriptive name
tied to the change (e.g. `overlay-routing-nested-header-footer.md`), not the
random `two-word-word.md` names the CLI generates.

Format — YAML frontmatter mapping each package to its bump level, then a blank
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

**Keep it brief.** A changeset note is a one-line changelog entry, not a summary
of the work. Most changes need a single sentence. Resist explaining the root
cause, the mechanism, the before/after, or every touched surface — the reader
wants to know what changed for them, nothing more. If you've written more than
~2 sentences (or bullets) for a routine fix, cut it back.

- Write for the changelog reader (a consumer of the library), not for reviewers
  of this PR. Say what the behaviour/API now does, not "fixed a bug in X".
- Lead with the area, e.g. `Overlay:`, `Grid:`, `Menu:`, when it helps scanning.
- Reference public API in backticks (`overlayRef.updatePositionStrategy(...)`).
- One sentence for simple changes. Add bullets only when several genuinely
  distinct things shipped — one line each, not a paragraph each.
- Keep it to what shipped — no root-cause analysis, no "verified in Storybook",
  no internal file paths, no rationale the reader doesn't need.

## Verify

After writing, sanity-check the frontmatter parses: package names are quoted,
each has a valid level (`patch` | `minor` | `major`), and the file has the
`---` … `---` block followed by a blank line and the note.

## Companion: docs

A change that warrants a `minor` or `major` changeset (new/changed/removed
public API or behavior) almost always also needs a docs update in `apps/docs` —
see the **`docs`** skill. Patch-level internal fixes usually don't.
