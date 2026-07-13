# @ethlete/eslint-plugin

These rules **enforce the styleguide** (`docs/STYLEGUIDE.md`). The doc is the human
source of truth; the plugin is its automated enforcement. They must stay in sync.

## When you add, change, or remove a rule

Do all of the following in the same change:

1. **Update `docs/STYLEGUIDE.md`** to match:
   - New/changed enforcement → add or edit the row in the **"Enforced by lint"**
     table (rule → `ethlete/<rule-name>`).
   - If a rule now enforces something previously described as a judgment call,
     move it out of the prose section into the table.
2. **Bump the version in the styleguide header** — `# Style Guide vX.Y.Z` (line 1).
   New rule / stricter enforcement → minor bump; wording/fix → patch.
3. **⚠️ ALWAYS UPDATE THE VITEPRESS DOCS — this is the step most easily forgotten.**
   The published rule reference lives at **`apps/docs/eslint/rules.md`** (a table row
   per rule, grouped by section, with `Fix`/`Default` columns) and the rule **count +
   coverage summary** in **`apps/docs/eslint/index.md`**. Adding, removing, or renaming
   a rule (or changing its default severity) **must** update both — `docs/STYLEGUIDE.md`
   is not enough. Grep `apps/docs/eslint` for the rule name to confirm it's in sync.
4. Wire the rule into `src/configs/recommended.js` and export it from `src/index.js`.
5. Add a **changeset** for `@ethlete/eslint-plugin` (see the `changeset` skill).

If a change makes a styleguide _judgment_ rule statically enforceable, also prune
that guidance from the `styleguide` / `rxjs-signals` / `angular-patterns` skills so
they keep covering only what lint can't.
