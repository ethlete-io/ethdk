---
'@ethlete/cli': patch
---

`et design visible-change` writes the diff pictures of a product into the same folder on every run and empties it first, so repeated runs no longer leave a new folder in `/tmp` each time.
