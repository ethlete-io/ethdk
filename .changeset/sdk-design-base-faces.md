---
'@ethlete/components': patch
'ethlete-studio': patch
'@ethlete/cli': none
---

The sdk design base ships its own faces.css and font files, so its colors sheet no longer imports a Studio file the package does not contain; Studio's type sheet imports the faces from the sdk.
