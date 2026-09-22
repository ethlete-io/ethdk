---
'@ethlete/query-devtools': major
'@ethlete/components': major
---

The devtools panel moved out of `@ethlete/components` into its own package, `@ethlete/query-devtools`, where `<et-query-devtools-lazy>` loads it on first open instead of shipping it - 125 kB gz an application no longer pays.
