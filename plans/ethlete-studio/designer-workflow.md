# Studio as a complete designer workspace

Status: future work, recorded 2026-10-29. Requirements and planning only; no implementation
or UI design has started. Parent plan: [Studio design system](design-system.md).

## Product goal

A designer can install Studio and work on a repository without needing an external code
editor, terminal or Git knowledge. Studio supports obtaining the project, working with the
agent, making direct design edits, and saving and sharing the resulting work.

This extends the current Studio workflow and supersedes the earlier decision to keep agent
chat in the CLI and direct editing outside Studio's scope. It does not restore the retired
Calls model or the old 1-7 workflow.

## 1. Agent chat inside Studio

Move the conversation with the agent into Studio. The designer should not need a separate
CLI session to request changes, discuss a design or continue after reviewing a sketch.

The conversation must have the current repository, product and work context available.
Define how the user references a selected part, sketch, variant or comment, and how an agent
reply links back to the affected design. Preserve useful context across navigation and
application restarts; decide conversation boundaries and persistence during detailed planning.

Expose whether the agent is working, waiting for input, interrupted or failed, and let the
user stop and resume work. Connection, authentication and missing prerequisites must be
handled from Studio. Investigate the existing unused chat integration before choosing what
to reuse; it is not automatically the target implementation.

Acceptance: from inside Studio, the user requests a change, reviews the resulting sketch,
provides feedback and continues with the agent without switching applications.

## 2. Direct design editing with agent awareness

Provide Figma-style editor controls so a designer can make small changes directly, starting
with properties such as border radius and margin. The user must be able to identify a design
target, inspect the relevant value, change it and see the result without asking the agent to
perform every adjustment.

Edits must persist in the project's authoritative design source. A temporary DOM or preview
override alone is insufficient: reloads, sketches and later agent work must retain the change.
The editor must identify whether a value comes from a token, an inherited part, a local
override or another styling source, and make the scope of the edit understandable.

The agent must receive a reliable record of user edits, including the target, property, old
and new values, and affected scope. It must not silently overwrite them using stale context.
Define how active agent work observes edits and how conflicting simultaneous changes are
resolved. The user and agent must see the same persisted revision.

Detailed planning must resolve:

- How rendered targets map to editable source locations, including nested components,
  headless implementations and inherited parts.
- Whether an edit changes one state, the entire component, a product token or another scope.
- How a change to an inherited part creates the appropriate product override.
- How undo/redo, agent edits, sketch rounds and sketch merges interact.
- Which values are editable initially and how unsupported or computed values are presented.

Acceptance: the user changes a radius or margin, reloads and retains the result; the agent
can explain and preserve that edit during its next change. An edit made during agent work
cannot be silently lost. Token-wide changes must be distinguishable from local changes.

## 3. Repository workflow inside Studio

Support obtaining a repository, creating and switching branches, committing and pushing
from Studio. Opening an existing checkout remains useful, but must not be a prerequisite.
Users should not need to understand Git commands or use an external editor to complete the
normal workflow.

Present actions in terms of the user's work, with enough information to understand what
will be saved or shared. Keep the implementation compatible with ordinary Git repositories
and collaboration with developers outside Studio.

Detailed planning must cover:

- Repository access and authentication, destination selection and initial clone.
- Preparing and starting the project's design environment, including required tools,
  dependencies and actionable recovery when setup fails.
- Creating and switching branches while accounting for unsaved and uncommitted work.
- Reviewing the exact changes included in a commit, including user edits and agent edits.
- Commit identity and messages, first push, remote tracking and subsequent pushes.
- Incoming remote work, divergence and conflicts, with a recovery path inside Studio.
- Failed authentication, unavailable remotes and interrupted operations without losing work.

Git may be an internal dependency, but the designer must not need to install or configure it
manually for the supported installation path. Determine the packaging and platform approach
during technical planning. The same applies to project tooling and agent prerequisites:
document a supported project contract and handle setup inside Studio instead of silently
depending on a developer's prepared machine.

Acceptance: on a supported fresh installation, the designer connects a repository, prepares
the design environment, starts a branch, edits with the agent and controls, reviews, commits
and pushes the work using Studio alone. Recoverable failures have an in-app path forward.

## Shared requirements and boundaries

Chat, editor controls and repository operations act on the same working state. Agree on
revision tracking and concurrent-write behavior before implementing each as an isolated
feature. Direct edits must participate in the existing sketch and review model; the exact
relationship needs a decision before implementation.

Repository status must account for changes made by external tools too. Agent execution,
branch switches and commits must not accidentally operate on a different checkout or stale
revision from the design being displayed.

These goals complement the [SDK catalog plan](sdk-component-catalog.md). The catalog provides
real inherited components; the editor must support product replacements built from headless
components as well. Do not assume that every editable part is a fixed Tier 3 template.

## Suggested planning sequence

1. Establish the shared working-state, source-targeting and agent-awareness requirements.
2. Detail the in-Studio chat and repository onboarding needed for the first complete journey.
3. Prove one persisted direct property edit that the agent observes and preserves.
4. Complete the branch, review, commit, push and recovery journey.
5. Expand editor controls and supported project setups using that proven workflow.

This sequence is a proposal, not an agreed implementation order. Each area needs further
planning before code or visual design. The SDK catalog's explicitly deferred grill session
remains separate; no grill session starts as part of recording these goals.
