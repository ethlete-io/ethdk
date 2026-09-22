---
'@ethlete/cli': patch
---

`et api setup` keeps the setup command's own output back and prints one line for the result. The output is only shown when the command fails, so a checkout's advice about its Makefile no longer competes with the CLI.
