---
'ethlete-studio': patch
---

Load each Sketches frame once on opening: the frame rows wait for the list width, so the layout no longer switches to the matrix after the first render and destroys every iframe while it loads.
