---
'@ethlete/agent-rules': patch
'@ethlete/cli': none
---

`sync` registers the design MCP server when the `et` binary is installed (`node_modules/.bin/et`) instead of when `@ethlete/cli` is a declared or installed dependency, so agent-rules no longer names the CLI.
