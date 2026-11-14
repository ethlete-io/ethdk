---
'@ethlete/cli': patch
---

The design part shooter draws another state of a part frame it just drew by switching the state in place, instead of loading the frame again, so the aktuell pass of `et design sketch check` loads each frame once.
