---
'@ethlete/agent-rules': patch
---

Run `ethlete-agents` without `tslib` installed. The CLI now inlines its TypeScript helpers, so a fresh Yarn 4 repo no longer fails with "Cannot find module 'tslib'".
