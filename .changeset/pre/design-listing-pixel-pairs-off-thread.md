---
'@ethlete/cli': patch
---

`design`: the sketch listing and the merge preview compare their picture pairs in a pool of worker threads, so a cold listing no longer decodes PNGs on the thread that answers requests.
