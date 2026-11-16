---
'@ethlete/components': minor
---

Breaking: the dropzone crop step left `DROPZONE_IMPORTS`; to crop, also import `DROPZONE_CROP_IMPORTS`. Apps that never crop save about 4.4 KB gzip.
