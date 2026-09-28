---
'@ethlete/components': patch
---

Dropzone now emits `deleteFail` when the delete request rejects or its `createArgs` throws, instead of leaving an unhandled rejection and firing neither delete output.
