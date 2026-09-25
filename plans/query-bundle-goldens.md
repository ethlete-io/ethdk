# Query bundle goldens

CI (Next) run 36071888061 on 2026-09-24 failed `treeshake:bundle-goldens`. Two rows are outside the tolerance
(2% or 512 B); every other row grew by less than 1%.

| Entry            | Expected | Actual  | Delta          |
| ---------------- | -------- | ------- | -------------- |
| `query-floor`    | 1105 B   | 1151 B  | +46 B (+4.2%)  |
| `query-client`   | 12230 B  | 12841 B | +611 B (+5.0%) |
| `query-deps +3p` | 12151 B  | 12755 B | +604 B (info)  |

The goldens were last updated in f2e1c0165. Since then about 20 commits changed `libs/query/src/lib`, among them
new features: `abort()`, `enabled` on the polling features, `triggeredBy`, `executeUntilSettled$`, the keep-previous
response, and an `HttpContext` token on every request (a80ef2411).

## Steps

1. Wait until no other session has uncommitted work in `libs/query` (S11 of `query-consumer-coverage.md` runs now).
2. Reproduce locally: `NX_NO_CLOUD=true npx nx run treeshake:bundle-goldens`.
3. `query-floor` first. A floor must not grow with a feature, so +46 B points to new unshakeable code. Suspect: a
   module-scope call without `/* @__PURE__ */`, for example the `new HttpContextToken(…)` of a80ef2411. Diagnose with
   `tools/treeshake/decompose.mjs`, bisect the commits above if that does not name it, fix it, and prove the floor
   returns to 1105 B.
4. `query-client`: after step 3, decompose the rest of the growth by commit. Growth from a feature the client
   really uses is accepted; growth from a feature the client does not use (for example polling, `abort`) is a
   tree-shaking defect and gets fixed like step 3.
5. Update the goldens only for the accepted growth: `npx nx run treeshake:bundle-goldens:update`. Commit only
   `tools/treeshake/goldens.json` with a message that names the accepted features and sizes.
6. A fix in `libs/query` gets a changeset (`fix`, patch). Run `ci-check` for the treeshake and query targets.
