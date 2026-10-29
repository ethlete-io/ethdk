# Import existing frontend code into Studio

Status: planning, 2026-10-29. Records the agreed direction and proposed tooling work.
No implementation or visual redesign has started. Parent: [Studio design system](design-system.md).
Related plans: [SDK catalog](sdk-component-catalog.md) and [Designer workflow](designer-workflow.md).

## Goal and boundary

A team can start design work from its existing product without first maintaining a second
collection of examples by hand. Support large, inconsistent repositories with missing or
stale stories, duplicated components, application state and backend dependencies.

The workflow is existing frontend → independent Studio design → design exploration → later
frontend implementation. Studio designs remain separate from production frontend code.
Import must not turn Studio into an editor that directly modifies the original application.
Translating accepted designs back into frontend code is a separate planning area; this plan
does not define that mechanism or promise automatic round trips.

The imported result must work as a Studio design without the original backend, authentication
or store infrastructure. The source application can supply reference renders during import;
its runtime is not a permanent dependency of the resulting design.

## Hard case: FIFA

The example checkout is `../fifagg/fifagg-frontend`. A preliminary file inventory found
1,489 `*.component.ts` files and 141 `*.stories.ts` files. These are file counts, not counts
of distinct useful components or working examples. The repository contains several apps,
Angular 21, older Ethlete packages, NgRx, API integrations and project-specific styling.

Tom's constraints:

- Most stories are not maintained; their presence does not establish usability or coverage.
- There are duplicate and triplicate implementations and substantial architectural drift.
- Much of the display depends on logic that must be replaced with static data, informed by
  the project's TypeScript types.
- An agent must not spend ten days manually reading and translating the repository.

FIFA is the stress case, not a requirement that every supported project have its structure.
Existing stories are optional evidence. Neither a working Storybook nor a fully runnable
application is a prerequisite for beginning source-based reconstruction.

## Import a selected view and its dependencies

Start with a concrete route or view the designer wants to change. Discover the components,
styles, assets and data relevant to that view. Do not require a complete repository migration
before the first useful design exists. A repository-wide index can be inexpensive and broad;
deep analysis and conversion must be scoped to the selected work.

Follow the implementation actually used by the view. Similar names and visual resemblance
do not establish that two components are interchangeable. Preserve meaningful differences
on initial import. Repeated uses of the same source component should reuse its imported
part when their context permits. Record context-specific differences explicitly.

Propose consolidation separately, after the initial result is understood. Import fidelity
and design cleanup must be reviewable as separate changes.

## Replace application logic with consistent static states

Read templates and relevant computations alongside types. Types constrain fixture shape,
but usually cannot express all valid relationships, status combinations, permissions or
conditions that determine the visible result.

Import the presentation of the computed result. For example, a view that combines stores
and requests into participants, permissions and status labels should receive consistent
static values representing that result. Do not reproduce the entire store and request graph
just to display it. Preserve interactions needed for design review with local state where
appropriate; importing every application behavior is outside this scope.

Fixtures must be deterministic and shared where parts represent the same entities. Generate
linked entities together rather than independently producing structurally valid objects
with inconsistent IDs or impossible combinations. Choose a small set of useful states;
do not enumerate every possible branch combination.

Distinguish domain data and display data. Reuse source domain types where useful for fixture
generation and validation. If importing those types would pull in application infrastructure,
define an explicit presentation contract and record its mapping to the source types. Do not
silently erase fields or invent business rules to make generation succeed.

Record assumptions that cannot be established from code or references. Request focused
clarification when an assumption materially changes the design; unrelated work can continue.

## Evidence, provenance and verification

Each imported part needs a stable identity and a mapping to its source files and export,
relevant styles and assets, source revision, and the view or example used as evidence.
Record which source states map to which Studio states, including fixture assumptions.

Track verification per state, with these initial evidence categories:

- Visually verified: compared against an original render under recorded conditions.
- Reconstructed from source: derived from code without a verified original render.
- Supplemented with assumptions: data or behavior required interpretation.

A part may have different evidence for different states. A successful build or a plausible
screenshot must not promote a reconstruction to visually verified.

When the original can run, capture the selected state with its viewport, theme, locale and
data conditions. Compare the Studio rendering under equivalent conditions. Pixel differences
are supporting evidence, not the sole acceptance criterion; fonts, assets, content, layout,
overlays and relevant interactions also need inspection. When it cannot run, retain the
limitation and validate source traceability, fixture consistency and standalone rendering.

## Tooling that keeps agent work bounded

The central tooling requirement is to avoid repeated manual discovery and file-by-file
translation. Deterministic discovery, generation and checks belong in reusable tools. The
agent handles ambiguous boundaries, presentation extraction and decisions the tools cannot
make reliably. The following capabilities are proposals to prove, not existing features.

### 1. Persistent repository index

Build a machine-readable index using project configuration, TypeScript/compiler metadata
and framework-aware template analysis. Capture apps, routes, source identities, inputs,
template dependencies, styles, assets, types and available examples. Mark dynamic or
unresolved edges instead of claiming a complete dependency graph.

Index by file hashes and relevant configuration/tool versions. Update changed files and
affected dependants instead of re-reading the repository on every task. Preserve stable
source identities across imports, and surface deletions or renames.

Provide bounded queries for a selected view, component usages, dependency paths, data
requirements and unresolved edges. Return relevant excerpts and source locations. Do not
dump the full repository or dependency graph into the agent's context.

### 2. Import scope and dependency classification

Produce a reviewable plan for the selected view: presentation dependencies to convert,
data to replace with fixtures, infrastructure to omit, and dependencies requiring a
decision. Include transitive style and asset requirements, not just TypeScript imports.

Stop dependency traversal at explicit presentation/data boundaries. Following an injected
service must not accidentally expand one view into the entire application. Report the
remaining boundary and what static result the design needs there.

Identify exact repeated source references automatically. Offer probable duplicates as
candidates with evidence; never merge them solely by name or similarity score.

### 3. Reusable fixture generation

Extract a bounded schema for the needed data, including unions, nullability and relevant
constraints. Combine it with source conditions and reusable project fixture recipes.
Support stable IDs, seeded values, linked entities and named states. Validate generated
fixtures against their declared contracts and explicit relationship constraints.

Cache reusable mappings such as how a participant, team or tournament becomes display
data. Keep unresolved semantics visible rather than filling them with arbitrary defaults.
Use deterministic substitutes for external resources needed by a fixture.

### 4. Studio generation and compatibility checks

Generate Studio part declarations, fixture wiring, provenance records and the import
report through one supported authoring path. Reuse imported dependencies across views.
Automate mechanical extraction where reliable; use bounded agent tasks for conversion that
requires interpretation. Do not assume arbitrary Angular templates can be converted by
string replacement.

Account for project styling systems and versions. Extract the required visual dependencies
without making the design permanently import the application bootstrap or framework runtime.
Legacy hardcoded values must remain representable during faithful import; requiring full
tokenization or a current SDK migration would make onboarding an architectural rewrite.
Determine how import declarations and fidelity checks coexist with current Studio rules
for tokens, imports, layers and component copying before generating designs in bulk.

### 5. Focused rendering and repair

Render only the selected states and affected dependencies. Reuse prepared reference captures
when their inputs have not changed. Return structured diagnostics and targeted differences
to the agent so a failed import does not trigger another repository-wide investigation.

Define a bounded repair policy. Repeated failure at the same boundary must produce an
actionable report, preserved progress and a narrower next step, rather than an endless
generate/render/retry loop. The retry limit needs to be chosen during the proof.

### 6. Resumable imports and later source changes

Persist progress, source fingerprints, mappings, decisions, generated outputs and unresolved
work. A session restart must resume completed work. Distinguish disposable index caches from
project records needed to understand and reproduce the imported design.

Detect changed source dependencies on a later import. Reuse unchanged work and report the
affected parts. An import refresh must not overwrite design work made in Studio. Define a
baseline and reviewable conflict behavior before supporting refresh; continuous bidirectional
synchronization is not an assumption of this plan.

## Measure efficiency before expanding

The requirement is to make onboarding practical, not merely to automate an unbounded amount
of work. Measure the following for each proof and repeat import:

- Time to repository index and time to first useful, independently rendered Studio view.
- Agent processing time, tool time, model/token cost and human preparation/review time.
- Files indexed versus files deeply analyzed, and generated versus reused parts and fixtures.
- Repair iterations, unresolved dependencies and states with each evidence category.
- Extra work for a second related view, an unchanged rerun and a changed dependency.

Set explicit run budgets for deep analysis, generation and repair. When a budget is reached,
return partial results and explain the remaining scope. Do not label an incomplete import
complete or use reduced fidelity to hide its cost.

Numerical targets are not agreed yet. Establish a measured baseline with FIFA, then set
onboarding and incremental-import targets before broad rollout. A ten-day manual effort is
the failure mode to avoid, not an acceptable default or a claimed measured baseline.

## Proposed implementation sequence

1. Select a representative FIFA view without relying on maintained stories. Bound its useful
   initial states and record available visual references and missing prerequisites.
2. Prove index queries and dependency classification for that view. The result must be a
   small, actionable import plan, with explicit data and infrastructure boundaries.
3. Produce an independent Studio design with deterministic fixtures, source mappings and
   a truthful verification report. Measure all preparation and repair work.
4. Import a related view and demonstrate reuse of components, fixture recipes and analysis.
   Repeat unchanged and after a source change to prove incremental cost and safe refresh.
5. Use the evidence to choose the authoring contract, budgets and next framework/project
   adapters. Test a cleaner unrelated repository before treating FIFA-specific recipes as
   general tooling.

Done for the first complete proof when a designer can work on the imported view independently
of production infrastructure, its gaps are visible, the frontend remains unchanged, and a
second import demonstrably reuses the first one's work. Record measured costs before making
claims about whole-repository throughput.

## Open decisions

- The Studio representation and rendering approach for arbitrary imported components,
  coordinated with the still-open SDK catalog rendering decision.
- The minimum reusable presentation contract and how much extraction can be deterministic.
- Fixture recipe storage, provenance format and cache locations.
- Admission rules for imported legacy styling without relaxing unrelated authored designs.
- How designers select a source view and resolve missing data or unavailable references.
- Performance targets, budget limits and the repair policy after the first measurement.
- Safe refresh and conflict handling once a Studio design has diverged from its import.

These need detailed planning and proof before implementation is treated as settled. The
separate design-to-frontend workflow remains outside this plan.
