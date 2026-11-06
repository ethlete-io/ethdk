---
'ethlete-studio': patch
'@ethlete/cli': patch
---

Lint now rejects a try/catch that ignores its error and returns a fallback in Studio and the design rules. A malformed token stylesheet is reported as a TOKEN-SELECTOR problem, and an invalid harness props JSON names its parse error.
