---
'@ethlete/timetrack': patch
'timetrack-app': patch
---

The mask warning read only ASCII, so a name with an umlaut was never reported and always sent.
Word boundaries and the capital test now use Unicode properties.
