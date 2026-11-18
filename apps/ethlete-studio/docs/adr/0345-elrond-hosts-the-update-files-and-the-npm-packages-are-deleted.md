---
status: accepted
open: B580
decided: 2026-11-18
source: doc-agent session 2026-11-18 (day shift), the human's answers on the access for the private SDK repo (ADR 0342, 0344)
---

# elrond hosts the update files, and the npm packages are deleted

Two answers of the human on the private SDK repo (ADR 0342), verbatim (German):

> 1. damit es fix geht nutzen wir erstmal elrond dafür würde ich sagen. [...] 4. ich. die npm packages werden
>    gelöscht. sie werden nur von uns genutzt.

Decided:

1. The updater files and installers of timetrack-app and ethlete-studio are served from elrond for now, so the switch
   happens soon. A dedicated update host may follow later.
2. The `@ethlete/*` packages on npmjs are deleted, not deprecated, because only our own projects use them. The human
   deletes them. This replaces "its existing versions are deprecated with a pointer" in ADR 0342, item 2. Every
   consumer must resolve `@ethlete/*` from Verdaccio before the deletion.
