---
name: comments
description: Comments are an allowlist of four cases. Everything else gets deleted before the change is done.
kind: rule
scope: both
---

## Comments: almost none, and never for the reviewer of your change

**Write no comment unless it fits one of the four cases below.** This is an allowlist, not a
set of tips. Anything outside it gets **deleted** before you call the change done — not
softened, not shortened. Code that needs prose to be understood needs a better name, a
smaller function, or a type; fix that instead of narrating it.

### The only comments allowed

1. **An ordering or timing constraint** a reasonable edit would break. Say what breaks.
2. **An invariant the types cannot express**, that a caller or a future edit could violate.
3. **A workaround**, naming its concrete cause (browser bug, upstream issue, framework
   limitation) and linking it where a link exists, so the next reader can tell when it may go.
4. **Public API JSDoc** — what it does and how to call it, on something a lib actually
   exports. One or two sentences. Not internals, not history, not why it is shaped that way.

Nothing else qualifies. Not "this is subtle", not "worth noting", not a heading over a group
of members, not a summary of the function underneath it.

### The test each one still has to pass

Delete it unless **both** are true:

- a competent reader who never sees your diff would be **surprised** without it, and
- a future edit could **break something** that this sentence is the only warning about.

Unsure counts as no. A missing comment costs a minute of reading; a stale one misleads for
years.

### Always delete

- **Restating the code** — `// increment the counter` over `counter++`; a JSDoc on `size` that
  says nothing beyond "the size of the button".
- **Section headers and dividers** — `// --- Inputs ---`, `// Helpers`, `// Public API`.
- **Rationale for a mechanical choice** — `Record<Size, X>` with literal keys, a `@__PURE__`
  annotation, a factory instead of a literal, a helper moved into its own file. The type, the
  annotation and the import already say what happens.
- **Migration narration** — "moved here from X", "used to be a tuple", "so Y no longer pulls
  Z", "renamed for clarity". Git knows; the next reader does not care.
- **The same explanation at every call site.** Explain a pattern once where it is defined (the
  helper's JSDoc, the lint rule's message, the guide) and let every use site stay silent.
- **Commented-out code.**
- **`TODO`/`FIXME` without an issue link.** Fix it now or leave nothing.
- **Hedging and meta** — "note that", "for clarity", "just in case", "this is cleaner", "we
  could also…".

### Before you call the change done

Re-read every comment in your diff and cut the ones that are not one of the four. Then fix or
delete any existing comment your change made wrong — one describing behaviour that no longer
exists is worse than none.

Two signals you have already over-commented: you wrote the word "because", or the diff adds
more than a handful of comments. Both mean go back and cut.
