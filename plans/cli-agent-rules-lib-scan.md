# cli + agent-rules scan - open findings

Scan of `libs/cli/src/` and `libs/agent-rules/src/` from 2026-09-28. 0 High, 1 Medium, 2 Low, 4 Spec (second pass included; verified 2026-09-28: 15 confirmed, 3 re-rated, 0 refuted). Skipped: nothing from the first-pass skip list; the second pass read `timetrack-command.ts`, `git-flow/parse.ts`, `frontmatter.ts`, `load-content.ts`, `plan.ts` warnings, `doctor/`, `config/diagnose.ts`, `api/help.ts`, `api/suggest.ts` and `api/state.ts`. Tree-shaking does not apply. Paths are relative to `libs/cli/src/lib/` or `libs/agent-rules/src/lib/`.

## cli: design, auth, release

- Low: the CLI takes the GitLab token as a positional argument (`auth/auth-command.ts`), so it lands in shell history and `ps`. Decision: keep it, or read it from stdin / an env var / a prompt instead. S
- Low: with `--force`, `git add .` puts every unrelated uncommitted change into the "Release versions" commit (`release.ts:60`). Decision: the docs (`apps/docs/cli/index.md`) promise exactly that; keep it, or stage only what `changeset version` changed. S

## Spec gaps

- Spec: `replaceMarkedBlock` has no test for two blocks (`render.spec.ts` covers a missing end marker and a reversed pair). S
- Spec: `migrate.ts` has no test for the symlink rollback. S
- Spec: `runApiSetup` (`api/setup.ts`) and `resolveApiCheckout` (`api/resolve-checkout.ts`) have no spec. M
- Spec: `design/serve.ts` has no spec, and `design/check.spec.ts` covers the browser cleanup but not the Windows path handling. M

## second pass

### agent-rules: git-flow parse

- Medium: with the default empty `keyPrefixes`, a subject that starts with `<word>-<number>` reads as an issue key (`git-flow/parse.ts:57-60`, default pattern at `git-flow/config.ts:71`). `feat/step-2-rework` gives `issueKey: STEP-2`, and timetrack attributes time to an issue that does not exist. Only a `key-case` finding marks it. Do not set `issueKey` for a lowercase match when `keyPrefixes` is empty. S Verified. Timetrack passes the favourite project keys as `keyPrefixes`, so this hits only while that list is empty, where `attribute.ts` trusts `parseBranch` on purpose.
