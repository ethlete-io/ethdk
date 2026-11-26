---
'@ethlete/cli': patch
'ethlete-studio': none
---

The design server serves frames from a checkout whose `node_modules` is a symlink, instead of answering `403 Restricted`. The studio canvas e2e checks that a frame shows content.
