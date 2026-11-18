# SDK component catalog for Studio

The SDK base is built: every public component family of `@ethlete/components` has an inheritable part under
`.ethlete/design/sdk/components`, rendered through `ng()`, and a product may override or replace it (ADR 0365, 0368).
This file holds what is still open.

## Open

- **Coverage check.** An automated check compares the public SDK families, their stories and the catalog entries. It
  detects a missing mapping, a broken example reference and a stale entry. A new public component needs a catalog entry or
  a reviewed exclusion with a reason. The component generator scaffolds the catalog wiring. No such check exists yet: the
  `sdk` product has 55 parts against 57 lib folders, and nothing names the difference.
- **Shared examples.** Storybook and Studio should consume one example definition where practical, never a second
  maintained collection of templates. The extraction format is not decided.
- **Distribution check.** The local `sdk` product and the built-in `@ethlete/components` base must not become two
  independently maintained catalogs. Verify the shipped base in a separate consuming repository with installed packages,
  without this repository's story sources or local paths, and account for SDK/CLI version compatibility.
- **Frame independence.** Repeated frame creation, state changes and disposal leave no orphan overlays or Angular
  applications; catalog states render independently of order, without network or clock dependencies.

Visual redesign stays in the sketch workflow; catalog work does not choose component designs. A change to this scope needs
the deferred grill session first.
