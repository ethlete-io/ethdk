---
'@ethlete/cli': patch
---

`et update` follows the dist tag that holds the newest version of the installed prerelease line, so a package that changesets published to `latest`, such as `@ethlete/agent-rules`, no longer stays on the older `next` version.
