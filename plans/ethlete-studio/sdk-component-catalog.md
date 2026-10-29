# SDK component catalog for Studio

Status: planning, 2026-10-29. No implementation or visual design work is authorized by this plan.
Before implementation, this plan needs a dedicated grill session to challenge its assumptions,
resolve open questions and sharpen the implementation slices. That session is deferred.
Parent plan: [Studio design system](design-system.md).

## Goal and agreed requirements

Make all public component families in `@ethlete/components` available as an inheritable
SDK design system in Studio. Tier 3 default components are the starting implementation.
A product may change any part of an inherited component, including its structure and
styling, and may use Tier 2 headless variants for its replacement. Token overrides are
the simplest customization path, not a limit on inheritance.

Render real SDK components. Replace the three current button, form-field and select
mocks once their replacements are proven. Existing stories are the source material for
examples, fixtures and states. Keep their behavior and design coverage as the catalog grows.

An inherited part must work in the consuming product's rendering context. An override
must take effect wherever another design part references it through the system. Products
must also be able to add examples and states for their own implementations.

## Current constraints

- `.ethlete/design/sdk` contains three parts backed by hand-maintained HTML mocks in
  `libs/components/design`. They reuse component CSS but reproduce the DOM themselves.
- The CLI already recognizes `@ethlete/components` as a built-in base. That base currently
  contains a button using `ng()`, which renders Angular on the server and returns markup.
- Studio drawings currently carry HTML, CSS and optional setup functions. They do not
  provide a general Angular browser runtime or an Angular component composition contract.
- Part resolution already supports a product overriding a base part through `@system`.
  It does not replace Angular components imported directly inside another Angular template.
- Stories include wrapper components, decorators, providers and examples with asynchronous
  behavior. Importing their args alone is insufficient to reproduce them.

## Proposed catalog structure

Use one stable part identity per public component family or independently useful default
component. Supporting directives and subcomponents belong to their family's examples;
they do not each need a separate tree entry. Determine the actual boundaries in the inventory.

Each catalog entry records:

- Its stable part identity and the public SDK exports it covers.
- Relevant source stories and the examples selected for Studio.
- Props accepted when composing it, named design states and useful widths.
- Required fixtures, providers, themes and setup for states such as an open overlay.
- Any coverage gaps or reason a story is excluded from the design matrix.

Keep composition props separate from demonstration states: a page must be able to supply
its own label, value or options instead of only selecting a canned story.
Define which props a replacement must retain for existing callers to keep working. A
product remains free to change its contract when it updates the affected compositions too.

Prefer shared example definitions consumed by Storybook and Studio where practical.
The exact extraction format and source location remain open until the first complete case
is proven. Do not duplicate every story into a second collection of maintained templates.

## Phase 1: inventory and coverage map

1. Enumerate public families and default components from the SDK exports and domain layout.
2. Inventory all component stories and associate them with those families. Distinguish
   variants, design states, compositions, behavior demonstrations and infrastructure examples.
3. Record missing examples and select a small representative design matrix per entry.
   Avoid generating the full Cartesian product of every control and interaction.
4. Include the three existing mock parts in the map and identify which existing part names
   and consumers must survive their replacement.

Done when every public family has an explicit catalog disposition and story mapping,
including gaps. Story discovery can be automatic; selection and grouping require review.

## Phase 2: prove rendering and replacement with Select

Use a real Select example, including its form-field and an open panel, for one complete
vertical case before rolling out the catalog.

1. Reuse its existing example template, fixtures and providers through an adapter or shared
   definition. Identify which Storybook facilities must be supplied by Studio.
2. Evaluate extending `ng()` versus mounting real Angular examples in browser frames.
   Compare state fidelity, overlays, product context, composition, cleanup, reload cost and
   support for the consuming repository's Angular version. SSR alone must not be assumed
   sufficient for browser-created states.
3. Render default, selected, disabled and open states deterministically. Use actual component
   state and behavior to establish them, without hand-reproducing overlay markup.
4. Render the inherited Select with a product's own tokens, themes and providers. Verify
   the panel as well as the trigger, including overlay theme propagation.
5. Replace the product's Select with a structurally different implementation using Tier 2.
   Compose that part inside an inherited element or page and prove the replacement appears.
6. Verify the existing sketch, comparison and merge flow with the replacement. A sketch of
   a base-only part must become an owned product implementation without editing the SDK.

Specify the boundary between system part composition and internal SDK composition explicitly.
Direct Angular imports are fixed dependencies today. Where an SDK composition must accept a
product replacement, determine whether a public slot/template API suffices or whether a
Studio composition adapter is required. Do not promise universal replacement of nested
Angular components without proving that mechanism.

Done when the complete case works with real components, product overrides and an open
overlay. Record the chosen renderer, composition boundary and remaining limitations before
expanding. This phase may change the proposed catalog format.

## Phase 3: establish the reusable authoring path

1. Apply the proven approach to Button and Form Field, alongside Select. Include input,
   textarea, label, hint, validation and relevant interaction states in the field coverage.
2. Define the minimal catalog declaration, shared example API and product override contract.
3. Establish state preparation and reset rules. Each frame must start independently;
   asynchronous examples need deterministic data and readiness signals.
4. Define frame disposal for Angular applications, subscriptions, listeners and overlays,
   including reloads and switching product or sketch.
5. Verify that a product override of foundations reaches inherited components and sketch
   previews without importing the base product's theme configuration by accident.
6. Replace the three mocks and update their consumers after equivalent coverage is proven.
   Remove unused mock APIs only after checking their consumers and compatibility impact.

Done when adding the next family follows a documented pattern and does not require another
rendering mechanism. Preserve existing accepted product designs during the migration.

## Phase 4: expand and distribute the complete SDK base

Expand in batches that exercise different needs: simple controls and display components;
forms and selection; composed navigation and data components; overlays and browser-dependent
components. Use the inventory to determine actual membership and order.

For each batch, reuse examples, select states, verify composition and product context, and
close or explicitly record coverage gaps. Include all inventoried families before claiming
the catalog complete.

Choose the canonical source and shipping location after the rendering case is proven.
The local `sdk` product and the built-in `@ethlete/components` base must not become two
independently maintained catalogs. Verify the shipped base in a separate consuming repository
using installed packages, without access to this repository's story sources or local paths.
Account for SDK/CLI version compatibility and include any required example assets in packaging.

## Phase 5: keep coverage current

Add an automated coverage check comparing public SDK families, stories and catalog entries.
It must detect missing mappings, broken example references and stale entries. A new public
component must receive a catalog entry or an explicit, reviewed exclusion with a reason.

Extend the component generator to scaffold the required catalog wiring once the format is
stable. Keep CI checks proportional: structural coverage for the full inventory, rendering
coverage for selected states, and focused behavior tests for rendering and inheritance risks.

## Acceptance and verification

- Every public family has catalog coverage or an explicit exclusion; no silent omissions.
- Tier 3 examples render the real SDK implementation, with no separately maintained DOM mocks.
- Product tokens and providers reach components and their overlays in normal and sketch views.
- A headless product replacement works on its own and through inherited system compositions.
- Existing sketch, compare, merge and base-only override workflows still work.
- Repeated frame creation, state changes and disposal leave no orphan overlays or applications.
- Catalog states render independently of order, without unintended network or clock dependencies.
- A separate repository can inherit the packaged base and customize it with its installed SDK.

Implementation includes the affected package changesets, documentation and appropriate checks.
Visual redesign decisions remain in the existing sketch workflow. Catalog integration itself
does not choose new component designs.

## Next implementation slice

Start with Phase 1 and the Select case in Phase 2. The immediate deliverable is a coverage map
and a demonstrated rendering/composition approach. Do not bulk-create the remaining catalog
until that approach supports unrestricted product implementations.
