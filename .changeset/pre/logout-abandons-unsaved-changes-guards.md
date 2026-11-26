---
'@ethlete/query': patch
---

`logout()` now abandons every unsaved-changes guard (`injectUnsavedChangesCoordinator().abandonAll('logout')`). Pressing logout with a dirty form used to leave a "discard your changes?" dialog floating over the login page the app had already redirected to, plus a tab still locked against closing - over edits that can no longer be saved. Guards created after a re-login work normally again.
