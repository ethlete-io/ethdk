# Wrong dist-tags for packages without a stable release

Status: open, found 2026-09-23. No change made.

Commit `cb76d93b1` removed `--tag` from the publish, because changesets rejects it in pre
mode. After that, changesets publishes a package that has no stable release to `latest`.
The publish log says "will be published to latest rather than next".

State after release #3099:

- `@ethlete/agent-rules`: `latest` = 0.1.0-next.16, `next` = 0.1.0-next.15
- `@ethlete/query-devtools`: `latest` = 1.0.0-next.12, `next` = 1.0.0-next.11

Packages with a stable release (for example `cdk`) get the correct `next` tag.

Check with `curl -s https://registry.npmjs.org/-/package/@ethlete%2F<name>/dist-tags`.

## Options (user decides)

1. Run `npm dist-tag add @ethlete/<name>@<version> next` locally after each release.
   OIDC trusted publishing cannot set dist-tags, so CI cannot do it.
2. Accept `latest` = prerelease until the two packages have a stable release.

Note: npm registry reads lag 2 to 5 minutes after "Successfully published". A 404 right
after the publish job is not a failure.
