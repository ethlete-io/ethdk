# cli + agent-rules scan - open findings

Scan of `libs/cli/src/` and `libs/agent-rules/src/` from 2026-09-28. 0 High, 1 Medium, 0 Low, 4 Spec (second pass included; verified 2026-09-28: 15 confirmed, 3 re-rated, 0 refuted). Skipped: nothing from the first-pass skip list; the second pass read `timetrack-command.ts`, `git-flow/parse.ts`, `frontmatter.ts`, `load-content.ts`, `plan.ts` warnings, `doctor/`, `config/diagnose.ts`, `api/help.ts`, `api/suggest.ts` and `api/state.ts`. 2 Low fixed or decided 2026-09-29 (auth token argument kept; `release.ts` stages only the versioned files). Tree-shaking does not apply. Paths are relative to `libs/cli/src/lib/` or `libs/agent-rules/src/lib/`.

## Spec gaps

- Spec: `replaceMarkedBlock` has no test for two blocks (`render.spec.ts` covers a missing end marker and a reversed pair). S
- Spec: `migrate.ts` has no test for the symlink rollback. S
- Spec: `runApiSetup` (`api/setup.ts`) and `resolveApiCheckout` (`api/resolve-checkout.ts`) have no spec. M
- Spec: `design/serve.ts` has no spec, and `design/check.spec.ts` covers the browser cleanup but not the Windows path handling. M

## second pass

### agent-rules: git-flow parse

- Medium: with the default empty `keyPrefixes`, a subject that starts with `<word>-<number>` reads as an issue key (`git-flow/parse.ts:57-60`, default pattern at `git-flow/config.ts:71`). `feat/step-2-rework` gives `issueKey: STEP-2`, and timetrack attributes time to an issue that does not exist. Only a `key-case` finding marks it. Do not set `issueKey` for a lowercase match when `keyPrefixes` is empty. S Verified. Timetrack passes the favourite project keys as `keyPrefixes`, so this hits only while that list is empty, where `attribute.ts` trusts `parseBranch` on purpose.
