# Decouple the SDK from its apps

Status: planning, 28.11.2026. Built by the builder as rows B912 (step 1) and B913 (steps 2-5), from the night of 28.11. Inventory:
`.claude/handoffs/agent-results/decouple-inventory.md`.

## Decided (human, 28.11.)

- No repo move for now. Studio and Timetrack stay in this repo.
- The design tool (`libs/cli/src/lib/design`, ~153k of ~170k lines) leaves `@ethlete/cli` and ships inside the Studio
  app. It does not have to be on npm.
- Studio and Timetrack each offer an MCP server the user adds to Claude, Codex or Cursor. Their usage text lives in the
  MCP tool descriptions and server instructions, not in agent-rules skills.
- `@ethlete/agent-rules` and `@ethlete/cli` import no app code and talk to an app only through its running interface.
  A Timetrack or Studio failure never blocks an SDK release.

## Hooks and CI scope (human, 28.11.)

- Each app ships a Claude plugin (MCP server + its hooks); Codex and Cursor get the MCP server alone.
- A change in one project runs only that project's CI: Studio work runs no SDK or Timetrack checks, and the same holds
  for every other project.

## Couplings to cut (from the inventory)

1. `libs/cli` core and design form a cycle: `json-file.ts` imports `design-file`, `prettier`, `write-journal`; design
   imports `json-file` ~12 times. A neutral shared module first.
2. `libs/cli/src/lib/index.ts` re-exports `./design`; Studio imports `@ethlete/cli/open-point` and
   `@ethlete/cli/sketch-frames` (4 files).
3. Studio's host starts the design server from the project's `node_modules/@ethlete/cli` (`design_server.rs`). It
   starts the bundled tool instead, still rendering with the project's own Angular and Vite.
4. Consumers run `yarn et design mcp` (`.mcp.json` in fifagg, tomflix). `et design` in `@ethlete/cli` becomes a thin
   forwarder to the installed Studio (clear error without one), so `.mcp.json` keeps working; an `et update`
   migration may later point it at the app directly.
5. `ethlete-agents timetrack` has its own client for Timetrack's `/agent` and `/agent/proof` endpoints (protocol v3,
   HMAC). It moves into Timetrack's MCP; the endpoint becomes a versioned contract. No consumer uses it.
6. `libs/cli` `update/agent-rules-sync.ts` and `update/plan.ts` import `@ethlete/agent-rules`, and agent-rules
   `plan.ts:322` checks for `@ethlete/cli`: a two-way edge to make one-way.
7. Skills `design-exploration`, `timetrack`, `e2e-triage`, `sdk-update` presume app commands; they move into the app
   MCP instructions or drop the app part.

## Order

1. CI: each group (SDK libs, Studio, Timetrack) runs only when `nx affected` hits it; each app releases on its own
   checks (follow-up of B828). Small and safe, can start before the reset.
2. Break the cli cycle (1) and the barrel (2); design becomes `libs/design` (private), still built into the cli.
3. Studio bundles `libs/design`; host starts the bundled tool (3); `et design` forwarder (4).
4. Timetrack MCP replaces `ethlete-agents timetrack` (5); Studio MCP served by the app.
5. One-way cli/agent-rules edge (6); app skills and hooks leave agent-rules (7, Open).

Done when: `@ethlete/cli` and `@ethlete/agent-rules` build and publish with Studio and Timetrack deleted from the
workspace, and fifagg's `.mcp.json` still opens the design MCP.

## Suspects after step 2 (Codex review, 28.11.)

Each fix needs a bite that is red on HEAD; without one the finding stays a Suspect.

1. `tools/scripts/e2e-check.mjs`: fixed in 9f311d026d, verified live in a scratch checkout. With the guard
   at `libs/cli/src/lib/source-hash.ts` and a stale dist, the pre-fix `cliBuildProblem` returned `undefined`,
   the fixed one "source hash differs".
2. `tools/scripts/studio-code.mjs`: fixed in 9f311d026d, verified live. After a cli-core-only commit, the
   pre-fix `cli-copy` served the older build; the fixed one built the new commit, and its copy holds the change.
3. `libs/cli/package.json` was missing from both hashes (TS and Rust), though the build copies it into the
   dist and `stamp.ts` / `fingerprint.ts` read its version. Fixed: both hash it; specs red on HEAD, green
   after; the fixture holds a `cli/package.json` (in `.nxignore`). Live: a package.json-only commit makes
   `cliBuildProblem` report "source hash differs". Every dist built before reads stale once.
4. Not real: the live scan with `libs/cli-core/src` added stays green on HEAD; cli-core imports no design.
5. Not real: HEAD hashes `cli-core/src` in both languages; a probe fixture with a cli-core file gave equal
   TS and Rust hashes. Only a test gap.
6. Not real: an edit in `libs/design/design` is refused on HEAD (probe green); only a test gap.
7. Not real: `layOutPackage` emits the cli-core targets on HEAD (probe asserts green); only a test gap.

## Step 4 decided (doc session, 28.11.)

Research: `.claude/handoffs/agent-results/b913-step4-research.md`.

- A stdio adapter `timetrack-mcp`, shipped by Timetrack, reads the app's `agent.json`, does the HMAC proof and posts to
  `/agent` v3. No HTTP MCP inside Tauri. `/agent` v3 is the versioned contract.
- One snake_case tool per existing op. Every write tool goes through the approval queue and returns
  `{status:"queued", approvalId}`; a contract spec pins that no write tool applies a change.
- The contract spec runs in CI for both sides (adapter and app).
- TypeScript in `libs/timetrack`, run with the user's node. The app shows the `claude mcp add` / `codex mcp add` line
  as one plain row with a copy button in its existing agent or settings area; a live shot before done.
- Slices: (a) client in `libs/timetrack` + stdio adapter with `status` and `jira_*` tools + contract spec; (b) the other
  tools; (c) skill text into the server instructions, snapshot/compare to a Timetrack script over `day.rows`, delete
  `ethlete-agents timetrack`. (c) updates the AGENTS.md snapshot paragraph and the commit-msg hook text in the same
  commit.
