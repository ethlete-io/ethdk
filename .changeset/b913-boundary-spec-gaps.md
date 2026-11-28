---
'@ethlete/cli': none
'@ethlete/cli-core': none
---

The design boundary spec also scans cli-core and allows the project-first vite load in serve.ts; the compile and source-hash specs bite on a missing cli-core target and a missing libs/design input.
