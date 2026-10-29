---
'@ethlete/cli': patch
'@ethlete/agent-rules': patch
---

`et design shot --variants --diff-props` compares each variant with the merged part drawn with the variant's state props, so changed props no longer paint the whole diff red.
