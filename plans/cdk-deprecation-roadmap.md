# cdk deprecation roadmap

**Status: open - deferred 2026-07-30, unblocked, purely a scheduling decision.**
Every port in the `cdk-port` plan set has shipped, so steps 1 and 2 below are
ready to run. The team chose not to run them yet: they are consumer-visible in a
way the ports are not (`@deprecated` JSDoc puts a strikethrough through cdk APIs
in every consuming app's editor), so they want a deliberate, announced change
rather than a tail-end commit of a port.

Ported and ready to be marked: breadcrumb, accordion, carousel, masonry,
pagination, skeleton, picture, query-error, rich-filter, table, sort, filter,
icons.

## Suggested order - each step is its own PR + changeset

1. Add a deprecation note to each ported cdk counterpart's docs page
   (`apps/docs/cdk/*`) pointing at the new component.
2. Mark the cdk package README + docs index as deprecated-for-new-code, and add
   `@deprecated` JSDoc on the ported components' public APIs.
3. Actual removal / major-version drop of cdk: out of scope here, requires
   consumer-app sign-off.

The original roadmap had a step between 2 and 3 to audit `contentful`'s cdk usage
before any removal talk. That blocker is gone: the contentful v5 modernization
dropped the dependency, and the `migrate-to-contentful-v5` generator already
tells consumers to remove the leftover `@ethlete/cdk` entry.
